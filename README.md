# CookiePilot 🍪

**The degen terminal for [Cookie Chain](https://www.cookiechain.wtf)** — an SVM chain with sub-second finality, ultra-low fees, and a growing degenerate ecosystem.

CookiePilot is a fully client-side web app that gives Cookie Chain natives one cockpit for everything: live chain health, a token screener, aggregator swaps with a **sub-second finality meter**, and a DAS asset explorer.

![CookiePilot](https://img.shields.io/badge/chain-Cookie_Chain-orange) ![wallet](https://img.shields.io/badge/wallet-Nightly-amber) ![stack](https://img.shields.io/badge/stack-React%20%2B%20Vite%20%2B%20Tailwind-blue)

## ✨ Features

| Feature | What it does |
| --- | --- |
| ⚡ **Chain Pulse** | Live slot/epoch progress, block height, total txs, real TPS, average block time (in ms!), circulating COOK supply, COOK/USD price, validator count — all streamed from `rpc.cookiescan.io` |
| 🍪 **Connect Nightly** | First-class [Nightly](https://nightly.app) wallet connect (recommended Cookie Chain wallet), address display, live native COOK balance, CookieScan profile link |
| 📊 **Markets** | Live screener across the entire Cookie Chain token registry (6,000+ tokens): USD & COOK pricing, 24h volume, liquidity, sort + search, one-click to swap |
| 🔄 **Swap** | Real swaps routed through the **Cookiebox aggregator** (all Cookie Chain DEX liquidity): live quotes with route breakdown per venue/pool, price impact, min-received, slippage control, unsigned-tx flow signed by *your* Nightly wallet — fully non-custodial |
| ⏱️ **Finality meter** | Every swap shows its own confirmation latency in **milliseconds + slots elapsed** — watch Cookie Chain's sub-second finality happen on your own transaction |
| 🖼️ **Assets** | Browse any wallet's tokens & NFTs via the **CookieScan DAS API** (`searchAssets` / `getAsset`) with collection grouping and CookieScan links |
| 🛡️ **UX & errors** | Full transaction lifecycle states (building → signing → sending → confirming → confirmed/failed), human-readable errors, CookieScan explorer links for every tx and address |

## 🔗 Cookie Chain ecosystem integrations

- **`rpc.cookiescan.io`** — chain data (JSON-RPC): epochs, performance samples, supply, vote accounts, tx broadcasting & confirmation
- **`api.cookiescan.io`** — CookieScan **DAS API** (`searchAssets`, `getAsset`) + **token registry** (`/api/tokens`, 6,477 tokens with live pricing)
- **`agg.cookiebox.app`** — **Cookiebox swap aggregator** (`/quote`, `/swap-tx`): quotes + builds unsigned v0 swap transactions across all Cookie Chain liquidity
- **`cookiescan.io`** — explorer deep-links for every transaction, address and asset
- **Nightly** — wallet connection & transaction signing (never custodial, keys never leave the wallet)

## 🚀 Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

Any static host works — the app is 100% client-side (no backend, no secrets, no custodial anything).

## 🧱 Stack

- React 18 + TypeScript + Vite + Tailwind CSS v4
- `@solana/web3.js` for RPC (Cookie Chain is SVM — standard Solana tooling)
- `@solana/wallet-adapter-*` with the **Nightly** adapter
- Cookiebox aggregator + CookieScan DAS/registry APIs

## 📌 Key addresses

| What | Address |
| --- | --- |
| Native COOK (wrapped native mint) | `So11111111111111111111111111111111111111112` |
| Example route pool (COOK → bCOOK, cookiebox-clmm) | `CR9ctRbohjCHzCcDjCvgaUZgAqW7mdmTHFHh2NqFazia` |

All other program/pool addresses are surfaced live per-swap in the route breakdown (venue + pool chips).

## 🌉 New to Cookie Chain?

Bridge COOK 1:1 from Solana mainnet via the [Hyperlane bridge](https://hyperlane.cookiescan.io), then connect Nightly and go degen.

## 📄 License & authorship

Built and maintained by **shinru** ([@user00shinru](https://github.com/user00shinru)) for the [Superteam Earn Cookie Chain cApp bounty](https://superteam.fun/earn/listing/create-an-app-on-cookie-chain-app).

MIT — see [LICENSE](LICENSE).
