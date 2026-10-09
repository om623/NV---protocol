/**
 * NV Protocol — Market Data CRE Workflow
 *
 * Purpose:
 *   Fetches real-time crypto prices (CoinGecko) and DeFi TVL (DeFiLlama)
 *   on a cron schedule, aggregates consensus across DON nodes, and makes
 *   the result available to the NV Agent context.
 *
 * Runtime environment:
 *   Compiled to WASM via Javy/QuickJS. No Node.js built-ins. No browser
 *   globals. All HTTP calls go through cre.capabilities.HTTPClient.
 *
 * Deployment:
 *   1. Install CRE CLI: https://docs.chain.link/cre/getting-started/cli-installation
 *   2. Authenticate: `cre login`
 *   3. Init project (already done): `cre init` was used to create this directory
 *   4. Install deps: `bun install` (inside this directory)
 *   5. Simulate: `cre workflow simulate --target staging-settings --config config.staging.json main.ts`
 *   6. Deploy: `cre workflow deploy --target staging-settings`
 *
 * External access required before deploy:
 *   • Chainlink DON access (apply at https://chain.link/developers)
 *   • Funded signing key on the target chain (for on-chain registry writes)
 *   • CRE login session (SSO via `cre login`)
 *
 * @chainlink/cre-sdk version: ^1.14.0
 */

import {
  Runner,
  CronCapability,
  HTTPClient,
  consensusMedianAggregation,
  consensusIdenticalAggregation,
  type Runtime,
  type NodeRuntime,
} from "@chainlink/cre-sdk";
import { z } from "zod";

// ─── Config schema ────────────────────────────────────────────────────────────

const configSchema = z.object({
  /** Cron expression — default every 5 minutes */
  schedule: z.string(),
  /** CoinGecko API base URL */
  coingeckoApiUrl: z.string().url(),
  /** DeFiLlama API base URL */
  defillamaApiUrl: z.string().url(),
  /** CoinGecko asset IDs to fetch */
  assets: z.array(z.string()).min(1),
  /** DeFiLlama chain names to include in TVL summary */
  tvlChains: z.array(z.string()).min(1),
});

type Config = z.infer<typeof configSchema>;

// ─── Types for workflow output ────────────────────────────────────────────────

interface AssetPrice {
  id: string;
  usdPrice: number;
  change24h: number | null;
}

interface ChainTvl {
  name: string;
  tvlUsd: number;
}

interface MarketDataReport {
  fetchedAtMs: number;
  prices: AssetPrice[];
  topTvl: ChainTvl[];
}

// ─── Workflow implementation ──────────────────────────────────────────────────

async function initWorkflow(runtime: Runtime, config: Config) {
  const cron = new CronCapability(runtime);
  const http = new HTTPClient(runtime);

  cron.on(config.schedule, async (nodeRuntime: NodeRuntime) => {
    /**
     * Each DON node fetches independently. Then consensus is applied:
     * - prices: median aggregation (robust to outlier nodes)
     * - TVL rankings: identical aggregation (all nodes must agree on order)
     */

    // Step 1: Fetch prices from CoinGecko (per node)
    const prices = await nodeRuntime.runInNodeMode(
      async (): Promise<AssetPrice[]> => {
        const ids = config.assets.join(",");
        const url = `${config.coingeckoApiUrl}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

        const response = await http.get(url, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`CoinGecko returned HTTP ${response.status}`);
        }

        const data = response.json() as Record<string, { usd: number; usd_24h_change?: number }>;

        return config.assets.map((id) => ({
          id,
          usdPrice: data[id]?.usd ?? 0,
          change24h: data[id]?.usd_24h_change ?? null,
        }));
      },
      // Median aggregation: consensus on the median price across nodes
      consensusMedianAggregation({
        keyPath: (item: AssetPrice) => item.id,
        valuePath: (item: AssetPrice) => item.usdPrice,
      }),
    );

    // Step 2: Fetch TVL from DeFiLlama (per node)
    const tvlData = await nodeRuntime.runInNodeMode(
      async (): Promise<ChainTvl[]> => {
        const url = `${config.defillamaApiUrl}/v2/chains`;

        const response = await http.get(url, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`DeFiLlama returned HTTP ${response.status}`);
        }

        const allChains = response.json() as Array<{ name: string; tvl: number }>;

        return config.tvlChains
          .map((chainName) => {
            const found = allChains.find(
              (c) => c.name.toLowerCase() === chainName.toLowerCase(),
            );
            return { name: chainName, tvlUsd: found?.tvl ?? 0 };
          })
          .filter((c) => c.tvlUsd > 0)
          .sort((a, b) => b.tvlUsd - a.tvlUsd);
      },
      // Identical aggregation: all nodes must return the same TVL ranking
      consensusIdenticalAggregation(),
    );

    // Step 3: Assemble final report
    const report: MarketDataReport = {
      fetchedAtMs: Date.now(),
      prices,
      topTvl: tvlData,
    };

    // Step 4: Emit report as workflow output
    // In a full integration, this would write to an on-chain contract or
    // a verified data feed. For the NV Agent integration, a listening
    // webhook or polling endpoint on the app server would consume this.
    runtime.emit("market_data_report", report);
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}
