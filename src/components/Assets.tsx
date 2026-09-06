import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { addrUrl, shortAddr } from "../chain";
import { dasSearchAssets, type DasAssetItem } from "../lib/api";

/** DAS asset explorer via api.cookiescan.io — browse any wallet's tokens & NFTs on Cookie Chain. */
export default function Assets() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [owner, setOwner] = useState("");
  const [assets, setAssets] = useState<DasAssetItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [solBalance, setSolBalance] = useState<number | null>(null);

  useEffect(() => {
    if (publicKey && !owner) setOwner(publicKey.toBase58());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  const search = useCallback(async (addr: string) => {
    setErr("");
    setAssets(null);
    setLoading(true);
    try {
      const items = await dasSearchAssets(addr, 24);
      setAssets(items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
    try {
      const bal = await connection.getBalance(new PublicKey(addr));
      setSolBalance(bal / 1e9);
    } catch {
      setSolBalance(null);
    }
  }, [connection]);

  useEffect(() => {
    if (owner && owner.length >= 32) void search(owner);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-stone-100">🖼️ Assets</h2>
        <span className="rounded-full border border-stone-700 bg-stone-900 px-2.5 py-0.5 text-xs text-stone-400">
          DAS API · api.cookiescan.io
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value.trim())}
          placeholder="Wallet address…"
          className="w-80 rounded-xl border border-stone-800 bg-stone-900/70 px-3 py-2 font-mono text-sm text-stone-100 placeholder-stone-600 outline-none focus:border-amber-500/60"
        />
        <button
          onClick={() => owner && void search(owner)}
          disabled={!owner}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-40"
        >
          Look up
        </button>
        {publicKey && (
          <button
            onClick={() => setOwner(publicKey.toBase58())}
            className="rounded-xl border border-stone-700 bg-stone-800 px-3 py-2 text-xs font-medium text-stone-300 transition hover:border-amber-500/60"
          >
            my wallet
          </button>
        )}
        {solBalance !== null && (
          <span className="self-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            native balance: {solBalance.toFixed(4)} COOK
          </span>
        )}
      </div>

      {err && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          DAS error: {err}
        </div>
      )}

      {loading && <p className="text-sm text-stone-500">searching assets…</p>}

      {assets && assets.length === 0 && !loading && (
        <div className="rounded-2xl border border-stone-800 bg-stone-900/60 px-4 py-10 text-center text-stone-500">
          no indexed assets for <span className="font-mono">{shortAddr(owner)}</span> — the wall
          might be empty. Mint something or bridge an NFT! 🍪
        </div>
      )}

      {assets && assets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a) => {
            const meta = a.content?.metadata;
            const img = a.content?.links?.image;
            const collection = a.grouping?.find((g) => g.group_key === "collection")?.group_value;
            return (
              <a
                key={a.id}
                href={addrUrl(a.id)}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-2xl border border-stone-800 bg-stone-900/60 transition hover:border-amber-500/50"
              >
                <div className="aspect-square w-full overflow-hidden bg-stone-950">
                  {img ? (
                    <img
                      src={img}
                      alt={meta?.name ?? a.id}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl">🍪</div>
                  )}
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-semibold text-stone-100">
                    {meta?.name ?? "Unnamed"}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-stone-500">
                    <span className="truncate">{collection ? `collection ${shortAddr(collection, 3)}` : a.interface ?? "asset"}</span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
