import { ARC_TESTNET_CHAIN_PARAMS, BASE_MAINNET_CHAIN_PARAMS, type NetworkConfig, type TokenConfig, getNetworkTokens } from '../networks';

/** Build EIP-3085 chain params from any registered network config. */
export function networkChainParams(net: NetworkConfig) {
  return {
    chainId: '0x' + net.chainId.toString(16),
    chainName: net.name,
    nativeCurrency: { name: net.nativeCurrency.symbol, symbol: net.nativeCurrency.symbol, decimals: net.nativeCurrency.decimals },
    rpcUrls: [net.rpcUrl],
    blockExplorerUrls: [net.explorerUrl],
  };
}

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

/** Legacy hardcoded token map for Arc Testnet (kept for backwards compatibility). */
export const ARC_TOKENS: Record<string, ArcTokenConfig> = {
  USDC: { symbol: 'USDC', address: null, decimals: 6, isNative: true },
  EURC: { symbol: 'EURC', address: '0x82aF49447D8a07e3bd9BD0b78325c7F9b5C98E3a', decimals: 6, isNative: false },
  ETH:  { symbol: 'ETH',  address: null, decimals: 18, isNative: true },
};

/** Build a token lookup map for any registered network. */
export function getTokensForNetwork(network: NetworkConfig): Record<string, ArcTokenConfig> {
  const tokens = getNetworkTokens(network);
  const map: Record<string, ArcTokenConfig> = {};
  for (const t of tokens) {
    map[t.symbol] = { symbol: t.symbol, address: t.address, decimals: t.decimals, isNative: t.isNative };
  }
  return map;
}

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
  await ensureNetwork(prov, ARC_TESTNET_CHAIN_PARAMS);
}

/** Switch the injected wallet to Base Mainnet (chainId 8453) for real payments. */
export async function ensureBaseNetwork(prov: Eip1193Provider): Promise<void> {
  await ensureNetwork(prov, BASE_MAINNET_CHAIN_PARAMS);
}

/** Switch the injected wallet to any registered network (used by all testnets). */
export async function ensureNetwork(prov: Eip1193Provider, params: { chainId: string }): Promise<void> {
  try {
    await prov.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: params.chainId }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902 || code === -32603) {
      await prov.request({
        method: 'wallet_addEthereumChain',
        params: [params],
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

export async function getAllBalances(
  prov: Eip1193Provider,
  address: string,
  tokenMap: Record<string, ArcTokenConfig> = ARC_TOKENS,
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    Object.values(tokenMap).map(async (t) => {
      if (t.isNative || !t.address) {
        const bal = await getNativeBalance(prov, address);
        return [t.symbol, bal] as const;
      }
      const bal = await getErc20Balance(prov, address, t.address, t.decimals);
      return [t.symbol, bal] as const;
    }),
  );
  const result: Record<string, number> = {};
  for (const [sym, bal] of entries) result[sym] = bal;
  return result;
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

// ─── Circle CCTP V2 Bridge ──────────────────────────────────────────────────

export interface CctpBridgeConfig {
  networkId: string;
  domainId: number;
  usdcAddress: string;
  tokenMessenger: string;
  explorerUrl: string;
}

export interface CctpBridgeResult {
  burnTxHash: string;
  mintTxHash?: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

// Circle CCTP V2
const CCTP_TOKEN_MESSENGER =
  '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';

const CCTP_FORWARDING_HOOK =
  '0x636374702d666f72776172640000000000000000000000000000000000000000';

const CCTP_NETWORKS: Record<string, CctpBridgeConfig> = {
  'arc-testnet': {
    networkId: 'arc-testnet',
    domainId: 26,
    usdcAddress: '0x3600000000000000000000000000000000000000',
    tokenMessenger: CCTP_TOKEN_MESSENGER,
    explorerUrl: 'https://testnet.arcscan.app',
  },

  'base-sepolia': {
    networkId: 'base-sepolia',
    domainId: 6,
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    tokenMessenger: CCTP_TOKEN_MESSENGER,
    explorerUrl: 'https://sepolia.basescan.org',
  },
};

export function getCctpConfig(
  networkId: string,
): CctpBridgeConfig | undefined {
  return CCTP_NETWORKS[networkId];
}

function numberToUint256Hex(
  amount: number,
  decimals: number,
): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid bridge amount');
  }

  const scaled = BigInt(
    Math.round(amount * Math.pow(10, decimals)),
  );

  return scaled.toString(16).padStart(64, '0');
}

function addressToBytes32(address: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid EVM address');
  }

  return address.slice(2).padStart(64, '0');
}

function encodeUint32(value: number): string {
  return value.toString(16).padStart(64, '0');
}

function encodeAddress(address: string): string {
  return addressToBytes32(address);
}

function encodeBytes32(value: string): string {
  return value.replace(/^0x/, '').padStart(64, '0');
}

// ─── ERC-20 approve ─────────────────────────────────────────────────────────

export async function approveUsdcForBridge(
  prov: Eip1193Provider,
  from: string,
  sourceNetworkId: string,
  amount: number,
): Promise<string> {
  const config = getCctpConfig(sourceNetworkId);

  if (!config) {
    throw new Error(`Unsupported bridge source: ${sourceNetworkId}`);
  }

  const amountHex = numberToUint256Hex(amount, 6);

  // approve(address,uint256)
  const selector = '095ea7b3';

  const data =
    '0x' +
    selector +
    encodeAddress(config.tokenMessenger) +
    amountHex;

  return (await prov.request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to: config.usdcAddress,
      data,
    }],
  })) as string;
}

// ─── CCTP depositForBurnWithHook ────────────────────────────────────────────

export async function depositForBurnWithForwarding(
  prov: Eip1193Provider,
  from: string,
  sourceNetworkId: string,
  destinationNetworkId: string,
  amount: number,
  maxFee: bigint,
): Promise<string> {
  const source = getCctpConfig(sourceNetworkId);
  const destination = getCctpConfig(destinationNetworkId);

  if (!source || !destination) {
    throw new Error('Unsupported CCTP network');
  }

  if (sourceNetworkId === destinationNetworkId) {
    throw new Error('Source and destination networks must differ');
  }

  const amountHex = numberToUint256Hex(amount, 6);

  // mintRecipient = connected wallet on destination
  const mintRecipient = addressToBytes32(from);

  // destinationCaller = bytes32(0)
  const destinationCaller =
    '0'.repeat(64);

  // maxFee
  const feeHex = maxFee.toString(16).padStart(64, '0');

  // Fast Transfer
  const finalityThreshold =
    encodeUint32(1000);

  // depositForBurnWithHook(
  //   uint256 amount,
  //   uint32 destinationDomain,
  //   bytes32 mintRecipient,
  //   address burnToken,
  //   bytes32 destinationCaller,
  //   uint256 maxFee,
  //   uint32 minFinalityThreshold,
  //   bytes hookData
  // )

  const selector =
    '0x' +
    'e4b5d7f0';

  const hookDataHex =
    CCTP_FORWARDING_HOOK.slice(2);

  const hookOffset =
    (8 * 32)
      .toString(16)
      .padStart(64, '0');

  const hookLength =
    (hookDataHex.length / 2)
      .toString(16)
      .padStart(64, '0');

  const data =
    selector +
    amountHex +
    encodeUint32(destination.domainId) +
    mintRecipient +
    encodeAddress(source.usdcAddress) +
    destinationCaller +
    feeHex +
    finalityThreshold +
    hookOffset +
    hookLength +
    hookDataHex.padEnd(64, '0');

  return (await prov.request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to: source.tokenMessenger,
      data,
    }],
  })) as string;
}

// ─── Circle Forwarding Service status ───────────────────────────────────────

export async function waitForBridgeCompletion(
  sourceNetworkId: string,
  burnTxHash: string,
  timeoutMs = 20 * 60 * 1000,
): Promise<string> {
  const source = getCctpConfig(sourceNetworkId);

  if (!source) {
    throw new Error('Unsupported CCTP source network');
  }

  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(
        `https://iris-api-sandbox.circle.com/v2/messages/${source.domainId}?transactionHash=${burnTxHash}`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );

      if (response.ok) {
        const data = await response.json() as {
          messages?: Array<{
            status?: string;
            forwardTxHash?: string;
          }>;
        };

        const message = data.messages?.[0];

        if (message?.forwardTxHash) {
          return message.forwardTxHash;
        }
      }
    } catch {
      // Keep polling
    }

    await new Promise(resolve =>
      setTimeout(resolve, 5000),
    );
  }

  throw new Error(
    'Bridge confirmation timeout. The burn transaction was submitted, but the destination mint was not confirmed yet.',
  );
}

// ─── Complete forwarding bridge ─────────────────────────────────────────────

export async function executeCctpBridge(
  prov: Eip1193Provider,
  from: string,
  sourceNetworkId: string,
  destinationNetworkId: string,
  amount: number,
  maxFee: bigint,
): Promise<CctpBridgeResult> {
  try {
    const approvalTx = await approveUsdcForBridge(
      prov,
      from,
      sourceNetworkId,
      amount + Number(maxFee) / 1_000_000,
    );

    await waitForTransaction(
      prov,
      approvalTx,
    );

    const burnTx = await depositForBurnWithForwarding(
      prov,
      from,
      sourceNetworkId,
      destinationNetworkId,
      amount,
      maxFee,
    );

    const mintTx = await waitForBridgeCompletion(
      sourceNetworkId,
      burnTx,
    );

    return {
      burnTxHash: burnTx,
      mintTxHash: mintTx,
      status: 'completed',
    };
  } catch (error) {
    return {
      burnTxHash: '',
      status: 'failed',
      error: error instanceof Error
        ? error.message
        : 'Bridge failed',
    };
  }
}

// ─── Wait for an EVM transaction ────────────────────────────────────────────

async function waitForTransaction(
  prov: Eip1193Provider,
  txHash: string,
  timeoutMs = 120_000,
): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const receipt = await prov.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });

    if (receipt) {
      const status = (receipt as { status?: string }).status;

      if (status === '0x0') {
        throw new Error('Transaction reverted');
      }

      return;
    }

    await new Promise(resolve =>
      setTimeout(resolve, 3000),
    );
  }

  throw new Error(
    'Transaction confirmation timeout',
  );
}
