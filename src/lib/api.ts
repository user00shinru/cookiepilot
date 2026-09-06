import {
  AGG_API,
  DAS_API,
  TOKEN_REGISTRY,
  type AggQuote,
  type AggSwapTx,
  type Registry,
  type RegistryToken,
} from "../chain";

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 45_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = await res.text();
        if (body) msg += `: ${body.slice(0, 300)}`;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Token registry (api.cookiescan.io /api/tokens) — 6k+ tokens w/ price + market data
// ---------------------------------------------------------------------------

const REGISTRY_CACHE_KEY = "cookiepilot.registry.v1";
const REGISTRY_TTL_MS = 10 * 60_000;

interface CachedRegistry {
  at: number;
  registry: Registry;
}

export async function loadRegistry(): Promise<Registry> {
  try {
    const raw = localStorage.getItem(REGISTRY_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as CachedRegistry;
      if (Date.now() - cached.at < REGISTRY_TTL_MS && cached.registry?.data?.length) {
        return cached.registry;
      }
    }
  } catch {
    /* cache miss is fine */
  }
  const registry = await fetchJson<Registry>(TOKEN_REGISTRY);
  try {
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({ at: Date.now(), registry } satisfies CachedRegistry),
    );
  } catch {
    /* storage full — ignore */
  }
  return registry;
}

export interface ListedToken {
  mint: string;
  symbol: string;
  name: string;
  logo?: string;
  decimals: number;
  priceUsd?: number;
  priceNative?: number;
  change24h?: number;
  volume24h?: number;
  liquidity?: number;
}

export function toListed(t: RegistryToken): ListedToken {
  return {
    mint: t.mint,
    symbol: t.metadata?.symbol ?? "???",
    name: t.metadata?.name ?? "Unknown",
    logo: t.metadata?.logo,
    decimals: typeof t.metadata?.decimals === "number" ? t.metadata.decimals : 9,
    priceUsd: t.price?.usd,
    priceNative: t.price?.native,
    change24h: t.price?.change24h,
    volume24h: t.marketData?.volume24h,
    liquidity: t.marketData?.liquidity,
  };
}

// ---------------------------------------------------------------------------
// Cookiebox aggregator (agg.cookiebox.app) — quote + unsigned v0 swap tx
// ---------------------------------------------------------------------------

export async function aggQuote(args: {
  inputMint: string;
  outputMint: string;
  amount: string; // raw
  slippageBps: number;
  owner?: string | null;
}): Promise<AggQuote | null> {
  const q = new URLSearchParams({
    inputMint: args.inputMint,
    outputMint: args.outputMint,
    amount: args.amount,
    slippageBps: String(args.slippageBps),
    ...(args.owner ? { owner: args.owner } : {}),
  });
  try {
    const body = await fetchJson<{ route: AggQuote }>(`${AGG_API}/quote?${q}`, undefined, 30_000);
    return body.route;
  } catch (e) {
    if (e instanceof Error && /HTTP 404|no route/i.test(e.message)) return null;
    throw e;
  }
}

export async function aggSwapTx(args: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  owner: string;
}): Promise<AggSwapTx> {
  return fetchJson<AggSwapTx>(`${AGG_API}/swap-tx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
}

// ---------------------------------------------------------------------------
// DAS API (api.cookiescan.io) — Metaplex Digital Asset Standard
// ---------------------------------------------------------------------------

export interface DasAssetItem {
  id: string;
  interface?: string;
  content?: {
    metadata?: { name?: string; symbol?: string; description?: string };
    links?: { image?: string; external_url?: string };
  };
  grouping?: { group_key: string; group_value: string }[];
}

export async function dasSearchAssets(ownerAddress: string, limit = 24): Promise<DasAssetItem[]> {
  const res = await fetchJson<{ items?: DasAssetItem[] }>(DAS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "cookiepilot",
      method: "searchAssets",
      params: { ownerAddress, limit, page: 1 },
    }),
  });
  return res.items ?? [];
}

export async function dasGetAsset(id: string): Promise<DasAssetItem | null> {
  const res = await fetchJson<{ result?: DasAssetItem }>(DAS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "cookiepilot",
      method: "getAsset",
      params: { id },
    }),
  });
  return res.result ?? null;
}
