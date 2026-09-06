import { useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { NightlyWalletAdapter } from "@solana/wallet-adapter-nightly";
import { BRIDGE, DOCS, EXPLORER, RPC_HTTP, SITE, TELEGRAM } from "./chain";
import WalletBar from "./components/WalletBar";
import ChainPulse from "./components/ChainPulse";
import Screener from "./components/Screener";
import Swap from "./components/Swap";
import Assets from "./components/Assets";

type Tab = "pulse" | "markets" | "swap" | "assets";

const TABS: { id: Tab; label: string }[] = [
  { id: "pulse", label: "⚡ Pulse" },
  { id: "markets", label: "📊 Markets" },
  { id: "swap", label: "🔄 Swap" },
  { id: "assets", label: "🖼️ Assets" },
];

export default function App() {
  const wallets = useMemo(() => [new NightlyWalletAdapter()], []);
  const [tab, setTab] = useState<Tab>("pulse");
  const [preset, setPreset] = useState<string | null>(null);

  return (
    <ConnectionProvider endpoint={RPC_HTTP}>
      <WalletProvider wallets={wallets} autoConnect={false} onError={(e) => console.warn(e)}>
        <WalletModalProvider>
          <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-10 pt-5">
            {/* header */}
            <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🍪</span>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-stone-50">
                    CookiePilot
                  </h1>
                  <p className="text-xs text-stone-500">
                    degen terminal for Cookie Chain · SVM · sub-second finality
                  </p>
                </div>
              </div>
              <WalletBar />
            </header>

            {/* tabs */}
            <nav className="mb-5 flex flex-wrap gap-1.5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    tab === t.id
                      ? "bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/20"
                      : "bg-stone-900/70 text-stone-400 hover:text-stone-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {/* content */}
            <main className="flex-1">
              {tab === "pulse" && <ChainPulse />}
              {tab === "markets" && (
                <Screener
                  onPick={(mint) => {
                    setPreset(mint);
                    setTab("swap");
                  }}
                />
              )}
              {tab === "swap" && (
                <Swap presetMint={preset} onConsumePreset={() => setPreset(null)} />
              )}
              {tab === "assets" && <Assets />}
            </main>

            {/* footer */}
            <footer className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-800/70 pt-5 text-xs text-stone-500">
              <span className="text-stone-400">Built for the Cookie Chain cApp bounty 🍪</span>
              <a href={DOCS} target="_blank" rel="noreferrer" className="hover:text-amber-300">
                docs
              </a>
              <a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-amber-300">
                CookieScan
              </a>
              <a href={BRIDGE} target="_blank" rel="noreferrer" className="hover:text-amber-300">
                bridge COOK
              </a>
              <a href={SITE} target="_blank" rel="noreferrer" className="hover:text-amber-300">
                cookiechain.wtf
              </a>
              <a href={TELEGRAM} target="_blank" rel="noreferrer" className="hover:text-amber-300">
                telegram
              </a>
              <span className="ml-auto font-mono">rpc: rpc.cookiescan.io</span>
            </footer>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
