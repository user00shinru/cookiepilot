// Cookie Chain core constants + typed RPC helpers.
// Docs: https://docs.cookiechain.wtf — RPC is standard Solana JSON-RPC (SVM).

export const RPC_HTTP = "https://rpc.cookiescan.io";
export const DAS_API = "https://api.cookiescan.io";
export const TOKEN_REGISTRY = "https://api.cookiescan.io/api/tokens";
export const AGG_API = "https://agg.cookiebox.app"; // Cookiebox swap aggregator
export const CANDY_API = "https://swap.cookiescan.io/api"; // Candy Shop aggregator (secondary)
export const EXPLORER = "https://cookiescan.io";
export const BRIDGE = "https://hyperlane.cookiescan.io";
export const DOCS = "https://docs.cookiechain.wtf";
export const TELEGRAM = "https://t.me/TheCookieNetChain";
export const SITE = "https://www.cookiechain.wtf";

/** Wrapped-native mint — on Cookie Chain this is COOK (native asset, 9 decimals). */
export const NATIVE_MINT = "So11111111111111111111111111111111111111112";
export const NATIVE_DECIMALS = 9;
export const NATIVE_SYMBOL = "COOK";

export const txUrl = (sig: string) => `${EXPLORER}/tx/${sig}`;
export const addrUrl = (addr: string) => `${EXPLORER}/account/${addr}`;

export function shortAddr(a: string, n = 4): string {
  return a.length <= 2 * n ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}

export function fmtNum(v: number, maxFrac = 4): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs !== 0 && abs < 0.0001) return v.toExponential(2);
  return v.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}

/** raw (bigint-string) -> human number using token decimals */
export function rawToNumber(raw: string | number, decimals: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return NaN;
  return n / 10 ** decimals;
}

/** human amount -> raw string using token decimals (float-safe enough for degen terminals) */
export function numberToRaw(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  const s = (amount * 10 ** decimals).toPrecision(15);
  return BigInt(Math.round(Number(s))).toString();
}

export interface RegistryToken {
  mint: string;
  metadata: { name: string; symbol: string; logo?: string; decimals?: number };
  price: { usd?: number; native?: number; change24h?: number };
  marketData: { volume24h?: number; liquidity?: number; volumeChange24h?: number } & Record<string, unknown>;
}

export interface Registry {
  success: boolean;
  cookUsd: number;
  count: number;
  data: RegistryToken[];
}

export interface AggSegment {
  pool: string;
  venue: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  percentage?: number;
  hopIndex: number;
}

export interface AggQuote {
  inAmount: string;
  outAmount: string;
  feePct: number;
  feeAmount: string;
  netOutAmount: string;
  minOutAmount: string;
  priceImpactPct: number | null;
  path: string[];
  isSplit: boolean;
  isMultiHop: boolean;
  segments: AggSegment[];
}

export interface AggSwapTx {
  transactionBase64: string;
  blockhash: string;
  lastValidBlockHeight: number;
  route: AggQuote;
}
