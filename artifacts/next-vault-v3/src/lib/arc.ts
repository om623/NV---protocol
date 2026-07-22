import { ARC_TESTNET_CHAIN_PARAMS } from '../networks';

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

export interface WalletBalances {
  usdc: number;
  eurc: number;
  eth: number;
}

export interface ArcTokenConfig {
  symbol: string;
  address: string | null;
  decimals: number;
  isNative: boolean;
}

export const ARC_TOKENS: Record<string, ArcTokenConfig> = {
  USDC: { symbol: 'USDC', address: null, decimals: 6, isNative: true },
  EURC: { symbol: 'EURC', address: '0x82aF49447D8a07e3bd9BD0b78325c7F9b5C98E3a', decimals: 6, isNative: false },
  ETH:  { symbol: 'ETH',  address: null, decimals: 18, isNative: true },
};

export function getProvider(): Eip1193Provider | null {
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth && typeof eth.request === 'function' ? eth : null;
}

export async function getAccounts(prov: Eip1193Provider): Promise<string[]> {
  return (await prov.request({ method: 'eth_requestAccounts' })) as string[];
}

export async function getChainId(prov: Eip1193Provider): Promise<number> {
  const id = await prov.request({ method: 'eth_chainId' });
  return typeof id === 'string' ? parseInt(id, 16) : (id as number);
}

export async function ensureArcNetwork(prov: Eip1193Provider): Promise<void> {
  try {
    await prov.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_TESTNET_CHAIN_PARAMS.chainId }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902 || code === -32603) {
      await prov.request({
        method: 'wallet_addEthereumChain',
        params: [ARC_TESTNET_CHAIN_PARAMS],
      });
    } else {
      throw err;
    }
  }
}

function toHex(n: number, decimals: number): string {
  const scaled = Math.round(n * Math.pow(10, decimals));
  return '0x' + scaled.toString(16);
}

export async function transferNative(
  prov: Eip1193Provider,
  from: string,
  to: string,
  amount: number,
): Promise<string> {
  const valueWei = toHex(amount, 18);
  return (await prov.request({
    method: 'eth_sendTransaction',
    params: [{ from, to, value: valueWei }],
  })) as string;
}

export async function transferErc20(
  prov: Eip1193Provider,
  from: string,
  tokenAddress: string,
  to: string,
  amount: number,
  decimals: number,
): Promise<string> {
  const scaled = toHex(amount, decimals);
  const transferSig = '0xa9059cbb';
  const paddedTo = to.slice(2).padStart(64, '0');
  const paddedAmount = scaled.slice(2).padStart(64, '0');
  const data = transferSig + paddedTo + paddedAmount;
  return (await prov.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: tokenAddress, data }],
  })) as string;
}

export async function getNativeBalance(prov: Eip1193Provider, address: string): Promise<number> {
  const bal = await prov.request({
    method: 'eth_getBalance',
    params: [address, 'latest'],
  });
  const wei = typeof bal === 'string' ? parseInt(bal, 16) : (bal as number);
  return wei / 1e18;
}

export async function getErc20Balance(
  prov: Eip1193Provider,
  address: string,
  tokenAddress: string,
  decimals: number,
): Promise<number> {
  const balanceOfSig = '0x70a08231';
  const paddedAddr = address.slice(2).padStart(64, '0');
  const data = balanceOfSig + paddedAddr;
  const result = await prov.request({
    method: 'eth_call',
    params: [{ to: tokenAddress, data }, 'latest'],
  });
  const hex = typeof result === 'string' ? result : '0x0';
  const raw = parseInt(hex, 16);
  return raw / Math.pow(10, decimals);
}

export async function getAllBalances(prov: Eip1193Provider, address: string): Promise<WalletBalances> {
  const [usdc, eurc, eth] = await Promise.all([
    getNativeBalance(prov, address),
    ARC_TOKENS.EURC.address
      ? getErc20Balance(prov, address, ARC_TOKENS.EURC.address, ARC_TOKENS.EURC.decimals)
      : Promise.resolve(0),
    Promise.resolve(0),
  ]);
  return { usdc, eurc, eth };
}

export function shortAddress(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

export interface PoolInfo {
  pair: string;
  reserveA: number;
  reserveB: number;
  apr: number;
  tvl: number;
}

export const MOCK_POOLS: PoolInfo[] = [
  { pair: 'USDC / EURC', reserveA: 1200000, reserveB: 1100000, apr: 12.4, tvl: 2300000 },
  { pair: 'USDC / ETH',  reserveA: 850000,  reserveB: 264.8,   apr: 18.7, tvl: 1700000 },
  { pair: 'EURC / ETH',  reserveA: 420000,  reserveB: 130.5,   apr: 22.1, tvl: 840000 },
];

export async function getPools(_prov: Eip1193Provider | null, _address: string | null): Promise<PoolInfo[]> {
  return MOCK_POOLS;
}
