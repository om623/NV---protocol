/**
 * NV Protocol — Market Data CRE Workflow  (@chainlink/cre-sdk v1.23)
 *
 * Purpose:
 *   Fetches real-time crypto prices (CoinGecko) and DeFi TVL (DeFiLlama)
 *   on a cron schedule, aggregates consensus across DON nodes, and returns
 *   a verified MarketDataReport.
 *
 * SDK: @chainlink/cre-sdk ^1.23.0
 * Runtime: compiled to WASM/QuickJS — no Node.js built-ins.
 *   HTTP is available via a restricted global `fetch` injected by the CRE runtime.
 *   We declare it here so TypeScript is happy; at deploy time the CRE compiler
 *   validates that only allowed APIs are used.
 *
 * Deployment prerequisites:
 *   1. Install CRE CLI: https://docs.chain.link/cre/getting-started/cli-installation
 *   2. Authenticate:    cre login
 *   3. Simulate:        cre workflow simulate --target staging-settings --config config.staging.json main.ts
 *   4. Deploy:          cre workflow deploy --target staging-settings
 *   NOTE: DON access required (apply at https://chain.link/developers).
 *
 * @chainlink/cre-sdk version: ^1.23.0
 */

// ─── CRE fetch shim ──────────────────────────────────────────────────────────
// The CRE WASM runtime injects a restricted `fetch` global. TypeScript does not
// know about it (lib: ["ES2020"] has no DOM), so we declare it here.
// The CRE CLI validates that the call is legitimate at compile/simulate time.
declare function fetch(
  url: string,
  init?: { headers?: Record<string, string>; method?: string; body?: string },
): Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

import {
  CronCapability,
  handler,
  consensusIdenticalAggregation,
  type Runtime,
  type NodeRuntime,
} from "@chainlink/cre-sdk";
import { z } from "zod";

// ─── Config schema ────────────────────────────────────────────────────────────

const configSchema = z.object({
  /** Cron expression — every 5 minutes by default */
  schedule: z.string(),
  /** CoinGecko API base URL */
  coingeckoApiUrl: z.string().url(),
  /** DeFiLlama API base URL */
  defillamaApiUrl: z.string().url(),
  /** CoinGecko asset IDs (comma-joined for query param) */
  assets: z.array(z.string()).min(1),
  /** DeFiLlama chain names to include in the TVL summary */
  tvlChains: z.array(z.string()).min(1),
});

type Config = z.infer<typeof configSchema>;

// ─── Output types ─────────────────────────────────────────────────────────────

interface AssetPrice {
  id: string;
  usdPrice: number;
  /** NaN when CoinGecko does not return a 24h change for this asset */
  change24h: number;
}

interface ChainTvl {
  name: string;
  tvlUsd: number;
}

interface MarketDataReport {
  /** Epoch ms when this report was assembled */
  fetchedAtMs: number;
  /** Per-asset consensus prices from CoinGecko */
  prices: ReadonlyArray<AssetPrice>;
  /** Top chains by TVL from DeFiLlama (descending, chains with tvlUsd > 0 only) */
  topTvl: ReadonlyArray<ChainTvl>;
}

// ─── Cron trigger ─────────────────────────────────────────────────────────────

const cron = new CronCapability();

// ─── Workflow handler ─────────────────────────────────────────────────────────

const marketDataHandler = handler(
  // The actual schedule comes from config.staging.json / config.production.json
  // at deploy time. The value here is a compile-time placeholder.
  cron.trigger({ schedule: "*/5 * * * *" }),

  async (runtime: Runtime<Config>): Promise<MarketDataReport> => {
    const { coingeckoApiUrl, defillamaApiUrl, assets, tvlChains } =
      runtime.config;

    // ── Step 1: Fetch CoinGecko prices on every DON node ─────────────────────
    // runInNodeMode() returns a zero-arg function that, when called, executes
    // the inner function on each DON node and applies consensus aggregation.
    // consensusIdenticalAggregation requires all nodes to return the same value.
    const fetchPrices = runtime.runInNodeMode(
      async (_nr: NodeRuntime<Config>): Promise<AssetPrice[]> => {
        const ids = assets.join(",");
        const url =
          `${coingeckoApiUrl}/simple/price` +
          `?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);

        const data = (await res.json()) as Record<
          string,
          { usd?: number; usd_24h_change?: number }
        >;

        return assets.map((id) => ({
          id,
          usdPrice: data[id]?.usd ?? 0,
          change24h: data[id]?.usd_24h_change ?? null,
        }));
      },
      consensusIdenticalAggregation<Promise<AssetPrice[]>>(),
    );

    // ── Step 2: Fetch DeFiLlama TVL on every DON node ────────────────────────
    const fetchTvl = runtime.runInNodeMode(
      async (_nr: NodeRuntime<Config>): Promise<ChainTvl[]> => {
        const res = await fetch(`${defillamaApiUrl}/v2/chains`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`DeFiLlama HTTP ${res.status}`);

        const allChains = (await res.json()) as Array<{
          name: string;
          tvl: number;
        }>;

        return tvlChains
          .map((chainName) => {
            const found = allChains.find(
              (c) => c.name.toLowerCase() === chainName.toLowerCase(),
            );
            return { name: chainName, tvlUsd: found?.tvl ?? 0 };
          })
          .filter((c) => c.tvlUsd > 0)
          .sort((a, b) => b.tvlUsd - a.tvlUsd);
      },
      consensusIdenticalAggregation<Promise<ChainTvl[]>>(),
    );

    // ── Step 3: Execute and assemble ─────────────────────────────────────────
    // Calling the returned functions triggers node execution + consensus.
    const prices = await fetchPrices().result();
    const topTvl = await fetchTvl().result();

    return {
      fetchedAtMs: Date.now(),
      prices,
      topTvl,
    };
  },
);

// ─── Workflow export ──────────────────────────────────────────────────────────
// CRE expects the default export to be an array of handler entries.

export default [marketDataHandler];
export { configSchema };
