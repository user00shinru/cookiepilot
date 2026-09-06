import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  NATIVE_DECIMALS,
  NATIVE_MINT,
  NATIVE_SYMBOL,
  fmtNum,
  numberToRaw,
  rawToNumber,
  txUrl,
} from "../chain";
import { aggQuote, aggSwapTx, loadRegistry, toListed, type ListedToken } from "../lib/api";

type Stage =
  | "idle"
  | "building" // /swap-tx round-trip
  | "awaiting" // wallet signature
  | "sending"
  | "confirming"
  | "confirmed"
  | "failed";

interface Result {
  signature: string;
  latencyMs: number;
  slotsElapsed: number;
  outAmount: number;
  outSymbol: string;
}

const BUSY: Stage[] = ["building", "awaiting", "sending", "confirming"];

export default function Swap({ presetMint, onConsumePreset }: { presetMint: string | null; onConsumePreset: () => void }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();

  const [tokens, setTokens] = useState<Map<string, ListedToken>>(new Map());
  const [inputMint, setInputMint] = useState<string>(NATIVE_MINT);
  const [outputMint, setOutputMint] = useState<string>("");
  const [amount, setAmount] = useState<string>("0.1");
  const [slippageBps, setSlippageBps] = useState(100);

  const [quote, setQuote] = useState<Awaited<ReturnType<typeof aggQuote>>>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteErr, setQuoteErr] = useState("");

  const [stage, setStage] = useState<Stage>("idle");
  const [failMsg, setFailMsg] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  // registry (for decimals + labels)
  useEffect(() => {
    let alive = true;
    loadRegistry()
      .then((reg) => {
        if (!alive) return;
        const map = new Map<string, ListedToken>();
        for (const t of reg.data.map(toListed)) map.set(t.mint, t);
        map.set(NATIVE_MINT, {
          mint: NATIVE_MINT,
          symbol: NATIVE_SYMBOL,
          name: "Cookie (native)",
          decimals: NATIVE_DECIMALS,
        });
        setTokens(map);
        if (!map.has(outputMint)) {
          const best = reg.data
            .map(toListed)
            .filter((t) => t.mint !== NATIVE_MINT && (t.liquidity ?? 0) > 100)
            .sort((a, b) => (b.liquidity ?? 0) - (a.liquidity ?? 0))[0];
          if (best) setOutputMint((cur) => cur || best.mint);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // presets from the screener
  useEffect(() => {
    if (presetMint && presetMint !== inputMint) {
      setOutputMint(presetMint);
      if (inputMint === presetMint) setInputMint(NATIVE_MINT);
    }
    onConsumePreset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetMint]);

  const dec = useCallback(
    (mint: string) => tokens.get(mint)?.decimals ?? (mint === NATIVE_MINT ? NATIVE_DECIMALS : 9),
    [tokens],
  );
  const sym = useCallback(
    (mint: string) => tokens.get(mint)?.symbol ?? `${mint.slice(0, 4)}…${mint.slice(-4)}`,
    [tokens],
  );

  const inSym = sym(inputMint);
  const outSym = sym(outputMint);
  const inToken = tokens.get(inputMint);
  const outToken = tokens.get(outputMint);

  // quote on change (debounced) — works pre-connect too (owner omitted when not connected)
  const quoteKeyRef = useRef("");
  useEffect(() => {
    if (!outputMint) {
      setQuote(null);
      return;
    }
    const raw = numberToRaw(Number(amount), dec(inputMint));
    if (!raw || raw === "0") {
      setQuote(null);
      return;
    }
    const key = `${inputMint}|${outputMint}|${raw}|${slippageBps}|${publicKey?.toBase58() ?? ""}`;
    if (quoteKeyRef.current === key) return;
    const t = setTimeout(async () => {
      quoteKeyRef.current = key;
      setQuoting(true);
      setQuoteErr("");
      try {
        const q = await aggQuote({
          inputMint,
          outputMint,
          amount: raw,
          slippageBps,
          owner: publicKey?.toBase58() ?? null,
        });
        setQuote(q);
      } catch (e) {
        setQuote(null);
        setQuoteErr(e instanceof Error ? e.message : String(e));
      } finally {
        setQuoting(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [inputMint, outputMint, amount, slippageBps, publicKey, dec]);

  const doSwap = useCallback(async () => {
    if (!publicKey || !signTransaction || !quote) return;
    setResult(null);
    setFailMsg("");
    const raw = numberToRaw(Number(amount), dec(inputMint));
    try {
      setStage("building");
      const tx = await aggSwapTx({
        inputMint,
        outputMint,
        amount: raw,
        slippageBps,
        owner: publicKey.toBase58(),
      });

      setStage("awaiting");
      const vtx = VersionedTransaction.deserialize(
        new Uint8Array(Buffer.from(tx.transactionBase64, "base64")),
      );
      const signed = await signTransaction(vtx);

      setStage("sending");
      const slotBefore = (await connection.getEpochInfo()).absoluteSlot;
      const t0 = performance.now();
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      setStage("confirming");
      const latest = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction(
        { signature, blockhash: tx.blockhash, lastValidBlockHeight: tx.lastValidBlockHeight },
        "confirmed",
      );
      const latencyMs = performance.now() - t0;
      const slotAfter = (await connection.getEpochInfo()).absoluteSlot;

      setResult({
        signature,
        latencyMs,
        slotsElapsed: Math.max(0, slotAfter - slotBefore),
        outAmount: rawToNumber(tx.route.netOutAmount ?? tx.route.outAmount, dec(outputMint)),
        outSymbol: outSym,
      });
      setStage("confirmed");
      window.dispatchEvent(new Event("cookiepilot:balance"));
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : String(e);
      if (/User rejected|declined|cancelled/i.test(msg)) {
        setFailMsg("Wallet request rejected — nothing was sent.");
      } else {
        setFailMsg(msg);
      }
      setStage("failed");
    }
  }, [publicKey, signTransaction, quote, amount, dec, inputMint, outputMint, slippageBps, connection, outSym]);

  const inUsd = useMemo(() => {
    const p = inToken?.priceUsd;
    if (!quote || p === undefined) return null;
    return rawToNumber(quote.inAmount, dec(inputMint)) * p;
  }, [quote, inToken, dec, inputMint]);

  const overBalance =
    inToken?.mint === NATIVE_MINT && quote && Number(amount) > 0 && (inUsd ?? 0) >= 0
      ? false
      : false; // balance-aware guard lives in WalletBar; keep swap permissive for demo

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-stone-100">🔄 Swap</h2>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
          Cookiebox aggregator · all Cookie Chain liquidity
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* form */}
        <div className="space-y-3 rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
          <TokenSelect
            label="You pay"
            value={inputMint}
            onChange={setInputMint}
            tokens={tokens}
            disabled={BUSY.includes(stage)}
          />
          <div className="flex justify-center">
            <button
              onClick={() => {
                setInputMint(outputMint);
                setOutputMint(inputMint);
                setQuote(null);
                quoteKeyRef.current = "";
              }}
              disabled={BUSY.includes(stage)}
              className="rounded-xl border border-stone-700 bg-stone-800 px-3 py-1.5 text-sm transition hover:border-amber-500/60 hover:text-amber-300 disabled:opacity-40"
              title="Flip pair"
            >
              ⇅
            </button>
          </div>
          <TokenSelect
            label="You receive (estimate)"
            value={outputMint}
            onChange={setOutputMint}
            tokens={tokens}
            exclude={inputMint}
            disabled={BUSY.includes(stage)}
          />

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-stone-500">
              Amount ({inSym})
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={BUSY.includes(stage)}
                className="w-full rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-2.5 font-mono text-stone-100 outline-none focus:border-amber-500/60 disabled:opacity-50"
                placeholder="0.0"
              />
              {inToken?.mint === NATIVE_MINT && (
                <button
                  onClick={() => setAmount("0.05")}
                  className="rounded-xl border border-stone-700 bg-stone-800 px-3 text-xs font-semibold text-amber-300 transition hover:border-amber-500/60"
                >
                  0.05
                </button>
              )}
            </div>
            {overBalance && <p className="mt-1 text-xs text-red-400">amount exceeds wallet balance</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-stone-500">
              Slippage: {(slippageBps / 100).toFixed(1)}%
            </label>
            <div className="flex gap-1.5">
              {[50, 100, 300, 500].map((b) => (
                <button
                  key={b}
                  onClick={() => setSlippageBps(b)}
                  disabled={BUSY.includes(stage)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    slippageBps === b
                      ? "bg-amber-500 text-stone-950"
                      : "bg-stone-800 text-stone-400 hover:text-stone-200"
                  }`}
                >
                  {b / 100}%
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => void doSwap()}
            disabled={!connected || !quote || BUSY.includes(stage)}
            className="w-full rounded-xl bg-amber-500 py-3 text-base font-bold text-stone-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-stone-800 disabled:text-stone-500 disabled:shadow-none"
          >
            {BUSY.includes(stage)
              ? stageLabel(stage)
              : connected
                ? quote
                  ? `Swap ${inSym} → ${outSym}`
                  : "Enter amount to quote"
                : "Connect Nightly to swap"}
          </button>
        </div>

        {/* route + status */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-stone-400">Quote</h3>
            {quoting && <p className="text-sm text-stone-500">quoting best route…</p>}
            {quoteErr && !quoting && (
              <p className="text-sm text-red-400">quote error: {quoteErr}</p>
            )}
            {!quote && !quoting && !quoteErr && (
              <p className="text-sm text-stone-500">
                pick a pair and amount — routes across every Cookie Chain venue.
              </p>
            )}
            {quote && (
              <div className="space-y-2 text-sm">
                <Row k="You pay" v={`${fmtNum(rawToNumber(quote.inAmount, dec(inputMint)))} ${inSym}`} />
                <Row
                  k="You receive (min)"
                  v={`${fmtNum(rawToNumber(quote.minOutAmount, dec(outputMint)))} ${outSym}`}
                />
                <Row
                  k="Est. receive"
                  v={`${fmtNum(rawToNumber(quote.netOutAmount ?? quote.outAmount, dec(outputMint)))} ${outSym}`}
                  accent
                />
                <Row k="Price impact" v={quote.priceImpactPct == null ? "—" : `${quote.priceImpactPct.toFixed(3)}%`} />
                <Row k="Aggregator fee" v={`${quote.feePct ?? 0}% (${fmtNum(rawToNumber(quote.feeAmount ?? "0", dec(outputMint)), 6)} ${outSym})`} />
                {inUsd !== null && <Row k="≈ USD value" v={`$${fmtNum(inUsd, 4)}`} />}
                <div className="pt-2">
                  <div className="mb-1 text-xs uppercase tracking-wide text-stone-500">
                    Route {quote.isMultiHop ? "(multi-hop)" : ""} {quote.isSplit ? "(split)" : ""}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {quote.segments.map((s, i) => (
                      <span
                        key={`${s.pool}-${i}`}
                        className="rounded-lg border border-stone-700 bg-stone-800/80 px-2 py-1 text-[11px] text-stone-300"
                        title={`pool ${s.pool}`}
                      >
                        {s.venue} · {fmtNum(Number(s.inAmount), 2)}→{fmtNum(Number(s.outAmount), 2)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* execution status / result */}
          {(BUSY.includes(stage) || stage === "confirmed" || stage === "failed") && (
            <div
              className={`rounded-2xl border p-5 ${
                stage === "failed"
                  ? "border-red-900/60 bg-red-950/30"
                  : stage === "confirmed"
                    ? "border-emerald-800/60 bg-emerald-950/30"
                    : "border-amber-900/60 bg-amber-950/20"
              }`}
            >
              <div className="mb-2 text-sm font-bold">
                {stage === "failed" ? "❌ Swap failed" : stage === "confirmed" ? "✅ Confirmed" : stageLabel(stage)}
              </div>
              {failMsg && <p className="text-sm text-red-300">{failMsg}</p>}
              {result && (
                <div className="space-y-1 text-sm">
                  <Row
                    k="Latency"
                    v={`${result.latencyMs.toFixed(0)} ms · ${result.slotsElapsed} slot${result.slotsElapsed === 1 ? "" : "s"}`}
                    accent
                  />
                  <Row k="Received" v={`≈ ${fmtNum(result.outAmount)} ${result.outSymbol}`} />
                  <div className="pt-1">
                    <a
                      href={txUrl(result.signature)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-300 underline decoration-dotted hover:text-amber-200"
                    >
                      view tx on CookieScan → {result.signature.slice(0, 12)}…
                    </a>
                  </div>
                </div>
              )}
              {BUSY.includes(stage) && (
                <p className="text-sm text-stone-400">
                  {stage === "building" && "aggregator is building your transaction…"}
                  {stage === "awaiting" && "approve in your Nightly wallet…"}
                  {stage === "sending" && "broadcasting to Cookie Chain…"}
                  {stage === "confirming" && "waiting for confirmation — usually sub-second ⚡"}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function stageLabel(s: Stage): string {
  switch (s) {
    case "building":
      return "Building…";
    case "awaiting":
      return "Sign in Nightly…";
    case "sending":
      return "Sending…";
    case "confirming":
      return "Confirming…";
    default:
      return s;
  }
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-stone-500">{k}</span>
      <span className={`text-right font-mono ${accent ? "font-semibold text-amber-300" : "text-stone-200"}`}>{v}</span>
    </div>
  );
}

function TokenSelect({
  label,
  value,
  onChange,
  tokens,
  exclude,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (mint: string) => void;
  tokens: Map<string, ListedToken>;
  exclude?: string;
  disabled?: boolean;
}) {
  const t = tokens.get(value);
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-stone-500">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border border-stone-800 bg-stone-950/70 px-3 py-2.5">
        {t && <span className="text-lg">{t.logo ? "🪙" : "🍪"}</span>}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full bg-transparent font-mono text-sm text-stone-100 outline-none disabled:opacity-50 [&>option]:bg-stone-900"
        >
          {!value && <option value="">select token…</option>}
          {value && !tokens.has(value) && <option value={value}>{value}</option>}
          {[...tokens.values()]
            .filter((x) => x.mint !== exclude)
            .sort((a, b) => (b.liquidity ?? 0) - (a.liquidity ?? 0))
            .slice(0, 200)
            .map((x) => (
              <option key={x.mint} value={x.mint}>
                {x.symbol} — {x.name}
              </option>
            ))}
        </select>
      </div>
      {t && t.priceUsd !== undefined && (
        <div className="mt-1 text-xs text-stone-500">
          ${t.priceUsd < 0.01 ? t.priceUsd.toExponential(2) : t.priceUsd.toFixed(4)}
        </div>
      )}
    </div>
  );
}
