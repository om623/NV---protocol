/**
 * NV Protocol — Market Data CRE Workflow  (@chainlink/cre-sdk v1.23)
 *
 * Purpose:
 *   Fetches real-time crypto prices (CoinGecko) and DeFi TVL (DeFiLlama)
 *   on a cron schedule, aggregates consensus across DON nodes, and emits
 *   a verified MarketDataReport.
 *
 * SDK:    @chainlink/cre-sdk v1.23.0
 * HTTP:   HTTPClient (http-actions@1.0.0-alpha) via sendRequest().
 *         CRE workflows do NOT use a bare fetch() global.  All HTTP goes
 *         through the capability system so requests are tracked and auditable.
 * Consensus strategy:
 *   consensusIdenticalAggregation — all DON nodes must return byte-identical
 *   JSON for the result to be accepted.  This detects node-level manipulation.
 *   For public price APIs with millisecond price fluctuation this is strict:
 *   a production deployment should add .withDefault(...) or switch to
 *   consensusMedianAggregation for numeric price fields.  This version uses
 *   identical-aggregation as the safe starting point.
 * NaN / null policy:
 *   CRE's CreSerializable<T> type rejects both null and NaN — null is in
 *   NonSerializable, and NaN serializes to null in JSON/protobuf.
 *   All numeric fields are required `number`.  Missing data is represented
 *   with `available: false` and a sentinel price of 0 — never presented to
 *   users as a real quote; the frontend checks `available` before rendering.
 *
 * Deployment prerequisites:
 *   1. Install CRE CLI: https://docs.chain.link/cre/getting-started/cli-installation
 *   2. Authenticate:    cre login
 *   3. Simulate:        cre workflow simulate --target staging-settings --config config.staging.json main.ts
 *   4. Deploy:          cre workflow deploy --target staging-settings
 *   NOTE: DON access required (apply at https://chain.link/developers).
 */

import {
  CronCapability,
  HTTPClient,
  handler,
  consensusIdenticalAggregation,
  json,
  ok,
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
  /** CoinGecko asset IDs to fetch */
  assets: z.array(z.string()).min(1),
  /** DeFiLlama chain names to include in the TVL summary */
  tvlChains: z.array(z.string()).min(1),
});

type Config = z.infer<typeof configSchema>;

// ─── Output types ─────────────────────────────────────────────────────────────
// All fields are required primitives (number | string | boolean) so the output
// satisfies CreSerializable<MarketDataReport>.
// null and NaN are NOT CRE-serializable.  Use `available: boolean` + sentinel 0.

interface AssetPrice {
  /** CoinGecko asset ID */
  id: string;
  /** USD price; 0 when available=false */
  usdPrice: number;
  /** 24h % change; 0 when available=false or not returned by CoinGecko */
  change24h: number;
  /** false when the asset was not present in the API response */
  available: boolean;
}

interface ChainTvl {
  /** DeFiLlama chain name */
  name: string;
  /** TVL in USD; 0 when available=false */
  tvlUsd: number;
  /** false when the chain was not found in the API response */
  available: boolean;
}

interface MarketDataReport {
  /** Epoch ms when this report was assembled on the DON */
  fetchedAtMs: number;
  /** Per-asset prices from CoinGecko, consensus-verified across DON nodes */
  prices: ReadonlyArray<AssetPrice>;
  /** Top chains by TVL from DeFiLlama, descending, consensus-verified */
  topTvl: ReadonlyArray<ChainTvl>;
}

// ─── HTTP capability instance ─────────────────────────────────────────────────

const httpClient = new HTTPClient();

// ─── Cron trigger ─────────────────────────────────────────────────────────────

const cron = new CronCapability();

// ─── Workflow handler ─────────────────────────────────────────────────────────

const marketDataHandler = handler(
  cron.trigger({ schedule: "*/5 * * * *" }),

  (runtime: Runtime<Config>): MarketDataReport => {
    const { coingeckoApiUrl, defillamaApiUrl, assets, tvlChains } =
      runtime.config;

    // ── Step 1: Fetch CoinGecko prices ────────────────────────────────────────
    // runInNodeMode executes fn synchronously on each DON node.
    // TInput = AssetPrice[] (synchronous — NOT Promise<AssetPrice[]>).
    const fetchPrices = runtime.runInNodeMode(
      (nr: NodeRuntime<Config>): AssetPrice[] => {
        const ids = assets.join(",");
        const url =
          `${coingeckoApiUrl}/simple/price` +
          `?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

        const resp = httpClient
          .sendRequest(nr, { url, method: "GET" })
          .result();

        if (!ok(resp)) {
          throw new Error(`CoinGecko HTTP ${resp.statusCode}`);
        }

        const data = json(resp) as Record<
          string,
          { usd?: number; usd_24h_change?: number } | undefined
        >;

        return assets.map((id): AssetPrice => {
          const entry = data[id];
          if (!entry || typeof entry.usd !== "number") {
            return { id, usdPrice: 0, change24h: 0, available: false };
          }
          return {
            id,
            usdPrice: entry.usd,
            change24h: typeof entry.usd_24h_change === "number"
              ? entry.usd_24h_change
              : 0,
            available: true,
          };
        });
      },
      consensusIdenticalAggregation<AssetPrice[]>(),
    );

    // ── Step 2: Fetch DeFiLlama TVL ───────────────────────────────────────────
    const fetchTvl = runtime.runInNodeMode(
      (nr: NodeRuntime<Config>): ChainTvl[] => {
        const resp = httpClient
          .sendRequest(nr, {
            url: `${defillamaApiUrl}/v2/chains`,
            method: "GET",
          })
          .result();

        if (!ok(resp)) {
          throw new Error(`DeFiLlama HTTP ${resp.statusCode}`);
        }

        const allChains = json(resp) as Array<{ name: string; tvl: number }>;

        return tvlChains
          .map((chainName): ChainTvl => {
            const found = allChains.find(
              (c) => c.name.toLowerCase() === chainName.toLowerCase(),
            );
            return {
              name: chainName,
              tvlUsd: typeof found?.tvl === "number" ? found.tvl : 0,
              available: typeof found?.tvl === "number" && found.tvl > 0,
            };
          })
          .filter((c) => c.available)
          .sort((a, b) => b.tvlUsd - a.tvlUsd);
      },
      consensusIdenticalAggregation<ChainTvl[]>(),
    );

    // ── Step 3: Execute and assemble ─────────────────────────────────────────
    const prices = fetchPrices().result();
    const topTvl = fetchTvl().result();

    return {
      fetchedAtMs: runtime.now().getTime(),
      prices,
      topTvl,
    };
  },
);

// ─── Workflow export ──────────────────────────────────────────────────────────

export default [marketDataHandler];
export { configSchema };
