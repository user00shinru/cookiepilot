import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { NATIVE_SYMBOL, addrUrl, shortAddr } from "../chain";

/** Top-right wallet pill: connect (Nightly first), address, live COOK balance, explorer link. */
export default function WalletBar() {
  const { connection } = useConnection();
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [balance, setBalance] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) return;
    try {
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / 1e9);
    } catch {
      setBalance(null);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    void refresh();
    const iv = setInterval(refresh, 5000);
    const onTx = () => void refresh();
    window.addEventListener("cookiepilot:balance", onTx);
    return () => {
      clearInterval(iv);
      window.removeEventListener("cookiepilot:balance", onTx);
    };
  }, [publicKey, refresh]);

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95"
      >
        🍪 Connect Nightly
      </button>
    );
  }

  const addr = publicKey.toBase58();
  return (
    <div className="flex items-center gap-2 rounded-xl border border-stone-800 bg-stone-900/70 px-3 py-2 text-sm">
      <a
        href={addrUrl(addr)}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-amber-300 hover:text-amber-200"
        title="View on CookieScan"
      >
        {shortAddr(addr)}
      </a>
      <span className="text-stone-600">|</span>
      <span className="font-semibold text-stone-100">
        {balance === null ? "…" : balance.toFixed(4)} {NATIVE_SYMBOL}
      </span>
      <button
        onClick={() => void disconnect()}
        title="Disconnect"
        className="ml-1 rounded-lg px-2 py-0.5 text-xs text-stone-400 transition hover:bg-stone-800 hover:text-stone-200"
      >
        ✕
      </button>
    </div>
  );
}
