import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  encodeFunctionData,
} from 'viem';

import {
  BRIDGE_NETWORKS,
  CCTP_V2,
  getBridgeNetwork,
} from './cctpBridge';

import type { Eip1193Provider } from './arc';

// ─── Minimal ABIs ───────────────────────────────────────────────────────────

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const TOKEN_MESSENGER_ABI = [
  {
    type: 'function',
    name: 'depositForBurn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
    ],
    outputs: [],
  },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BridgeExecutionParams {
  provider: Eip1193Provider;
  fromNetwork: string;
  toNetwork: string;
  walletAddress: string;
  amount: number;
}

export interface BridgeExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addressToBytes32(address: string): `0x${string}` {
  return `0x${address.replace(/^0x/, '').padStart(64, '0')}`;
}

function getNetworkOrThrow(id: string) {
  const network = getBridgeNetwork(id);

  if (!network) {
    throw new Error(`Unsupported bridge network: ${id}`);
  }

  return network;
}

// ─── Approve USDC ────────────────────────────────────────────────────────────

async function approveUSDC(
  walletClient: ReturnType<typeof createWalletClient>,
  tokenAddress: string,
  amount: bigint,
  account: `0x${string}`,
): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [
      CCTP_V2.tokenMessenger,
      amount,
    ],
    account,
    chain: undefined,
  });
}

// ─── Start CCTP burn ─────────────────────────────────────────────────────────

export async function executeBridge(
  params: BridgeExecutionParams,
): Promise<BridgeExecutionResult> {
  try {
    const {
      provider,
      fromNetwork,
      toNetwork,
      walletAddress,
      amount,
    } = params;

    const source = getNetworkOrThrow(fromNetwork);
    const destination = getNetworkOrThrow(toNetwork);

    const destinationDomain = CCTP_V2.domains[
      toNetwork as keyof typeof CCTP_V2.domains
    ];

    if (destinationDomain === undefined) {
      throw new Error(
        `CCTP domain not configured for ${destination.name}`,
      );
    }

    if (!source.usdcAddress) {
      throw new Error(
        `USDC contract address is not configured for ${source.name}`,
      );
    }

    if (amount <= 0) {
      throw new Error('Bridge amount must be greater than zero');
    }

    const account = walletAddress as `0x${string}`;

    const walletClient = createWalletClient({
      account,
      transport: custom(provider),
    });

    const publicClient = createPublicClient({
      transport: http(source.rpcUrl),
    });

    const amountUnits = parseUnits(
      amount.toString(),
      source.usdcDecimals,
    );

    // 1. Approve TokenMessengerV2 to burn the USDC.
    const approveTx = await approveUSDC(
      walletClient,
      source.usdcAddress,
      amountUnits,
      account,
    );

    await publicClient.waitForTransactionReceipt({
      hash: approveTx,
    });

    // 2. Burn USDC on the source chain.
    const burnData = encodeFunctionData({
      abi: TOKEN_MESSENGER_ABI,
      functionName: 'depositForBurn',
      args: [
        amountUnits,
        destinationDomain,
        addressToBytes32(walletAddress),
        source.usdcAddress as `0x${string}`,
      ],
    });

    const burnTx = await walletClient.sendTransaction({
      account,
      to: CCTP_V2.tokenMessenger,
      data: burnData,
      chain: undefined,
    });

    return {
      success: true,
      txHash: burnTx,
    };

  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Bridge transaction failed',
    };
  }
}
