import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { NATIVE_SYMBOL, RPC_HTTP, fmtNum } from "../chain";
import { loadRegistry } from "../lib/api";

interface EpochInfo {
  absoluteSlot: number;
  blockHeight?: number;
  epoch: number;
  slotIndex: number;
  slotsInEpoch: number;
  transactionCount?: number;
}

interface PerfSample {
  period: number;
  numTransactions: number;
  numSlots: number;
  samplePeriodSecs: number;
}

function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  return fetch(RPC_HTTP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "cookiepilot", method, params }),
  }).then((r) => r.json() as Promise<{ result: T }>).then((r) => r.result);
}

/** Live chain pulse: slot/epoch, TPS, block time, supply, COOK price, finality proof. */
export default function ChainPulse() {
  const { connection } = useConnection();
  const [epoch, setEpoch] = useState<EpochInfo | null>(null);
  const [tps, setTps] = useState<number | null>(null);
  const [slotMs, setSlotMs] = useState<number | null>(null);
  const [supply, setSupply] = useState<number | null>(null);
  const [version, setVersion] = useState<string>("");
  const [cookUsd, setCookUsd] = useState<number | null>(null);
  const [validators, setValidators] = useState<number | null>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const tickEpoch = async () => {
      try {
        const e = await connection.getEpochInfo();
        if (alive) {
          setEpoch(e);
          setErr("");
        }
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    };
    const tickSlow = async () => {
      try {
        const [samples, sup, ver, votes] = await Promise.all([
          rpc<PerfSample[]>("getRecentPerformanceSamples", [8]),
          rpc<{ value: { circulating: number } }>("getSupply"),
          rpc<{ "solana-core": string }>("getVersion"),
          rpc<{ current: unknown[]; delinquent: unknown[] }>("getVoteAccounts"),
        ]);
        if (!alive) return;
        if (samples?.length) {
          const txs = samples.reduce((s, x) => s + x.numTransactions, 0);
          const secs = samples.reduce((s, x) => s + x.samplePeriodSecs, 0);
          const slots = samples.reduce((s, x) => s + x.numSlots, 0);
          setTps(secs > 0 ? txs / secs : null);
          setSlotMs(slots > 0 ? (secs * 1000) / slots : null);
        }
        setSupply((sup?.value?.circulating ?? 0) / 1e9);
        setVersion(ver ? `v${ver["solana-core"]}` : "");
        setValidators(votes ? votes.current.length + votes.delinquent.length : null);
      } catch {
        /* slow metrics are best-effort */
      }
    };
    const tickPrice = async () => {
      try {
        const reg = await loadRegistry();
        if (alive) setCookUsd(reg.cookUsd ?? null);
      } catch {
        /* price is best-effort */
      }
    };
    void tickEpoch();
    void tickSlow();
    void tickPrice();
    const ivFast = setInterval(tickEpoch, 3000);
    const ivSlow = setInterval(tickSlow, 30000);
    const ivPrice = setInterval(tickPrice, 60000);
    return () => {
      alive = false;
      clearInterval(ivFast);
      clearInterval(ivSlow);
      clearInterval(ivPrice);
    };
  }, [connection]);

  const epochPct = epoch ? (epoch.slotIndex / epoch.slotsInEpoch) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-stone-100">⚡ Chain Pulse</h2>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
          sub-second finality
        </span>
        {version && (
          <span className="rounded-full border border-stone-700 bg-stone-900 px-2.5 py-0.5 text-xs text-stone-400">
            agave {version}
          </span>
        )}
      </div>
      {err && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          RPC error: {err}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Card label="Slot" value={epoch ? epoch.absoluteSlot.toLocaleString("en-US") : "…"} pulse />
        <Card
          label="Epoch"
          value={epoch ? `${epoch.epoch}` : "…"}
          sub={epoch ? `${epochPct.toFixed(1)}% complete` : undefined}
        />
        <Card label="Block height" value={epoch ? (epoch.blockHeight ?? 0).toLocaleString("en-US") : "…"} />
        <Card
          label="Total txs"
          value={epoch ? (epoch.transactionCount ?? 0).toLocaleString("en-US", { notation: "compact" }) : "…"}
        />
        <Card label="Throughput" value={tps === null ? "…" : `${fmtNum(tps, 0)} TPS`} />
        <Card
          label="Avg block time"
          value={slotMs === null ? "…" : `${slotMs.toFixed(0)} ms`}
          highlight={slotMs !== null && slotMs < 1000}
        />
        <Card
          label={`${NATIVE_SYMBOL} circulating`}
          value={supply === null ? "…" : `${fmtNum(supply, 0)} ${NATIVE_SYMBOL}`}
        />
        <Card
          label={`${NATIVE_SYMBOL} price`}
          value={cookUsd === null ? "…" : `$${cookUsd < 0.01 ? cookUsd.toFixed(6) : cookUsd.toFixed(4)}`}
        />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
          <span>epoch {epoch?.epoch ?? "…"}</span>
          <span>
            {epoch ? `${epoch.slotIndex.toLocaleString("en-US")} / ${epoch.slotsInEpoch.toLocaleString("en-US")} slots` : ""}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-1000"
            style={{ width: `${Math.min(100, Math.max(0, epochPct))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  pulse,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  pulse?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div
        className={`mt-1 truncate text-xl font-bold ${highlight ? "text-amber-300" : "text-stone-100"} ${pulse ? "animate-cookiepulse" : ""}`}
        title={value}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-stone-500">{sub}</div>}
    </div>
  );
}
