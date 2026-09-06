import { useEffect, useMemo, useState } from "react";
import { NATIVE_MINT, fmtNum } from "../chain";
import { loadRegistry, toListed, type ListedToken } from "../lib/api";

type SortKey = "liquidity" | "volume24h" | "change24h";

/** Token screener: live Cookie Chain token registry (price, liquidity, volume). Click → swap. */
export default function Screener({ onPick }: { onPick: (mint: string) => void }) {
  const [tokens, setTokens] = useState<ListedToken[] | null>(null);
  const [cookUsd, setCookUsd] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("liquidity");
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    loadRegistry()
      .then((reg) => {
        if (!alive) return;
        setTokens(reg.data.map(toListed));
        setCookUsd(reg.cookUsd ?? null);
      })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (!tokens) return [];
    const q = query.trim().toLowerCase();
    const filtered = tokens.filter(
      (t) =>
        !q ||
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.mint.toLowerCase().includes(q),
    );
    const val = (t: ListedToken) =>
      sort === "change24h" ? (t.change24h ?? -Infinity) : (t[sort] ?? -Infinity);
    return filtered.sort((a, b) => val(b) - val(a)).slice(0, 40);
  }, [tokens, query, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-stone-100">📊 Markets</h2>
        <span className="rounded-full border border-stone-700 bg-stone-900 px-2.5 py-0.5 text-xs text-stone-400">
          {tokens ? `${tokens.length.toLocaleString("en-US")} tokens live` : "loading registry…"}
        </span>
        {cookUsd !== null && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
            COOK ${cookUsd < 0.01 ? cookUsd.toFixed(6) : cookUsd.toFixed(4)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search token / mint…"
          className="w-56 rounded-xl border border-stone-800 bg-stone-900/70 px-3 py-2 text-sm text-stone-100 placeholder-stone-600 outline-none focus:border-amber-500/60"
        />
        <div className="flex overflow-hidden rounded-xl border border-stone-800">
          {(["liquidity", "volume24h", "change24h"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`px-3 py-2 text-xs font-medium transition ${
                sort === k
                  ? "bg-amber-500 text-stone-950"
                  : "bg-stone-900/70 text-stone-400 hover:text-stone-200"
              }`}
            >
              {k === "volume24h" ? "volume" : k}
            </button>
          ))}
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          Registry error: {err}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-stone-800 bg-stone-900/60">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-stone-800 text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="px-4 py-3">Token</th>
              <th className="px-4 py-3 text-right">Price USD</th>
              <th className="px-4 py-3 text-right">Price COOK</th>
              <th className="px-4 py-3 text-right">24h vol</th>
              <th className="px-4 py-3 text-right">Liquidity</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.mint}
                className={`border-b border-stone-800/60 transition hover:bg-stone-800/40 ${
                  t.mint === NATIVE_MINT ? "bg-amber-500/5" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <TokenIcon t={t} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-stone-100">
                        <span className="truncate">{t.symbol}</span>
                        {t.mint === NATIVE_MINT && (
                          <span className="rounded bg-amber-500/20 px-1 text-[10px] font-bold text-amber-300">
                            native
                          </span>
                        )}
                      </div>
                      <div className="max-w-[180px] truncate text-xs text-stone-500">{t.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-stone-300">
                  {t.priceUsd === undefined ? "—" : `$${fmtNum(t.priceUsd, 6)}`}
                </td>
                <td className="px-4 py-3 text-right font-mono text-stone-400">
                  {t.priceNative === undefined ? "—" : fmtNum(t.priceNative, 6)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-stone-400">
                  {t.volume24h === undefined ? "—" : fmtNum(t.volume24h, 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-stone-400">
                  {t.liquidity === undefined ? "—" : fmtNum(t.liquidity, 0)}
                </td>
                <td className="px-4 py-3 text-right">
                  {t.mint !== NATIVE_MINT && (
                    <button
                      onClick={() => onPick(t.mint)}
                      className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500 hover:text-stone-950"
                    >
                      swap →
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!tokens && !err && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                  loading token registry…
                </td>
              </tr>
            )}
            {tokens && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                  no tokens match “{query}”
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TokenIcon({ t, size = 28 }: { t: ListedToken; size?: number }) {
  const [bad, setBad] = useState(false);
  const url = t.logo && !bad ? t.logo : null;
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-700 bg-stone-800 text-xs"
      style={{ width: size, height: size }}
    >
      {url ? (
        <img
          src={url}
          alt={t.symbol}
          onError={() => setBad(true)}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span>🍪</span>
      )}
    </div>
  );
}
