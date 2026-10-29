import type { NetworkConfig, TokenConfig } from '../networks';

const LIFI_TOKENS_URL = 'https://li.quest/v1/tokens';
const MAX_DISCOVERED_TOKENS = 60;
const CACHE_TTL_MS = 10 * 60 * 1000;

type LifiToken = {
  chainId?: number;
  address?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  priceUSD?: string;
  logoURI?: string;
  logoUrl?: string;
};

type LifiTokenResponse = {
  tokens?: Record<string, LifiToken[]>;
};

const tokenCache = new Map<number, { expiresAt: number; tokens: TokenConfig[] }>();
const tokenRequests = new Map<number, Promise<TokenConfig[]>>();

function validAddress(address: unknown): address is string {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Discover LI.FI-listed ERC-20s for the selected EVM mainnet.
 * Existing network-config tokens always win. Only validated addresses and
 * bounded decimal values are accepted; duplicate symbols are omitted because
 * the current swap UI identifies assets by symbol.
 */
export async function discoverLifiTokens(network: NetworkConfig): Promise<TokenConfig[]> {
  if (network.type !== 'mainnet' || !Number.isSafeInteger(network.chainId)) return [];

  const cached = tokenCache.get(network.chainId);
  if (cached && cached.expiresAt > Date.now()) return cached.tokens;

  const inFlight = tokenRequests.get(network.chainId);
  if (inFlight) return inFlight;

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = new URL(LIFI_TOKENS_URL);
      url.searchParams.set('chains', String(network.chainId));
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`LI.FI token registry returned HTTP ${response.status}`);
      const data = await response.json() as LifiTokenResponse;
      const listed = data.tokens?.[String(network.chainId)] ?? [];
      const configuredSymbols = new Set(network.tokens.map(token => token.symbol.toUpperCase()));
      const seenSymbols = new Set(configuredSymbols);
      const seenAddresses = new Set(
        network.tokens.filter(token => token.address).map(token => token.address!.toLowerCase()),
      );
      const discovered: TokenConfig[] = [];

      for (const token of listed) {
        if (discovered.length >= MAX_DISCOVERED_TOKENS) break;
        const symbol = typeof token.symbol === 'string' ? token.symbol.trim() : '';
        const name = typeof token.name === 'string' ? token.name.trim() : '';
        const address = token.address;
        const decimals = token.decimals;
        if (!symbol || !name || symbol.length > 20 || name.length > 80) continue;
        if (!validAddress(address) || address.toLowerCase() === '0x0000000000000000000000000000000000000000') continue;
        if (!Number.isInteger(decimals) || decimals! < 0 || decimals! > 36) continue;
        if (seenSymbols.has(symbol.toUpperCase()) || seenAddresses.has(address.toLowerCase())) continue;
        // Exclude malformed symbols that can break compact token controls.
        if (!/^[a-zA-Z0-9._-]+$/.test(symbol)) continue;

        seenSymbols.add(symbol.toUpperCase());
        seenAddresses.add(address.toLowerCase());
        const logoURI = [token.logoURI, token.logoUrl].find((candidate): candidate is string => typeof candidate === "string" && candidate.length <= 2048 && /^https:\/\//i.test(candidate));
        discovered.push({ symbol, name, decimals: decimals!, address, isNative: false, ...(logoURI ? { logoURI } : {}) });
      }

      tokenCache.set(network.chainId, { expiresAt: Date.now() + CACHE_TTL_MS, tokens: discovered });
      return discovered;
    } finally {
      clearTimeout(timeout);
      tokenRequests.delete(network.chainId);
    }
  })();

  tokenRequests.set(network.chainId, request);
  return request;
}
