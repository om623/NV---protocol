import assert from 'node:assert/strict';
import {
  discoverLifiBridgeNetworks,
  discoverLifiBridgeTokens,
  formatLifiUnits,
  getLifiTokenAddress,
  parseLifiUnits,
} from '../src/lib/lifiBridge';
import type { NetworkConfig } from '../src/networks';

const NATIVE = '0x0000000000000000000000000000000000000000';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const BRIDGED_USDC = '0x1111111111111111111111111111111111111111';

const ethereum: NetworkConfig = {
  id: 'ethereum',
  name: 'Ethereum',
  shortName: 'ETH',
  chainId: 1,
  type: 'mainnet',
  color: 'bg-indigo-500',
  icon: 'E',
  rpcUrl: 'https://cloudflare-eth.com',
  explorerUrl: 'https://etherscan.io',
  nativeCurrency: { symbol: 'ETH', decimals: 18 },
  status: 'online',
  tokens: [
    { symbol: 'ETH', name: 'Ether', decimals: 18, address: null, isNative: true },
    { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: USDC, isNative: false },
  ],
};

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('/chains?')) {
    return new Response(JSON.stringify([
      { id: 1, name: 'Ethereum', chainType: 'EVM' },
      { id: 1151111081099710, name: 'Solana', chainType: 'SVM' },
    ]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/tokens?chains=1')) {
    return new Response(JSON.stringify({
      tokens: {
        '1': [
          { chainId: 1, address: NATIVE, symbol: 'ETH', name: 'Ether', decimals: 18 },
          { chainId: 1, address: USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
          { chainId: 1, address: BRIDGED_USDC, symbol: 'USDC', name: 'Bridged USD Coin', decimals: 6 },
          { chainId: 1, address: 'not-an-address', symbol: 'BAD', name: 'Bad token', decimals: 18 },
        ],
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

try {
  const networks = await discoverLifiBridgeNetworks([ethereum]);
  assert.equal(networks.length, 1, 'only LI.FI-listed configured EVM networks are exposed');
  assert.equal(networks[0].id, 'ethereum');

  const tokens = await discoverLifiBridgeTokens(ethereum);
  assert.equal(tokens.length, 3, 'configured assets are retained and distinct same-symbol contracts remain selectable');
  assert.equal(tokens.filter(token => token.symbol === 'USDC').length, 2);
  assert.equal(getLifiTokenAddress(tokens.find(token => token.isNative)!), NATIVE);
  assert.equal(getLifiTokenAddress(tokens.find(token => token.address?.toLowerCase() === BRIDGED_USDC.toLowerCase())!), BRIDGED_USDC);

  assert.equal(parseLifiUnits('1.234567', 6), 1234567n);
  assert.equal(parseLifiUnits('0.000000000000000001', 18), 1n);
  assert.equal(formatLifiUnits('1234567', 6), '1.234567');
  assert.throws(() => parseLifiUnits('-1', 6), /valor válido/);
  assert.throws(() => parseLifiUnits('1.0000001', 6), /casas decimais/);

  console.log('LI.FI Bridge tests passed.');
} finally {
  globalThis.fetch = originalFetch;
}
