import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  encodeFunctionData,
  pad,
} from 'viem';

import {
  CCTP_V2,
  getBridgeNetwork,
} from './cctpBridge';

import type { Eip1193Provider } from './arc';

// ─── USDC testnet addresses ─────────────────────────────────────────────────

const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  'base-sepolia':
    '0x036CbD53842c5426634e7929541eC2318f3dCF7e',

  'arc-testnet':
    '0x3600000000000000000000000000000000000000',

  'sepolia':
    '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
};

// ─── CCTP V2 ABIs ──────────────────────────────────────────────────────────

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'spender',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
  },
] as const;

const TOKEN_MESSENGER_V2_ABI = [
  {
    type: 'function',
    name: 'depositForBurn',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
      },
      {
        name: 'destinationDomain',
        type: 'uint32',
      },
      {
        name: 'mintRecipient',
        type: 'bytes32',
      },
      {
        name: 'burnToken',
        type: 'address',
      },
      {
        name: 'destinationCaller',
        type: 'bytes32',
      },
      {
        name: 'maxFee',
        type: 'uint256',
      },
      {
        name: 'minFinalityThreshold',
        type: 'uint32',
      },
    ],
    outputs: [],
  },
] as const;

const MESSAGE_TRANSMITTER_V2_ABI = [
  {
    type: 'function',
    name: 'receiveMessage',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'message',
        type: 'bytes',
      },
      {
        name: 'attestation',
        type: 'bytes',
      },
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
  burnTxHash?: string;
  mintTxHash?: string;
  status?: 'burned' | 'minted';
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNetworkOrThrow(id: string) {
  const network = getBridgeNetwork(id);

  if (!network) {
    throw new Error(`Unsupported bridge network: ${id}`);
  }

  return network;
}

function getUsdcAddress(networkId: string): `0x${string}` {
  const address = USDC_ADDRESSES[networkId];

  if (!address) {
    throw new Error(
      `USDC address is not configured for ${networkId}`,
    );
  }

  return address;
}

function addressToBytes32(
  address: string,
): `0x${string}` {
  return pad(address as `0x${string}`, {
    size: 32,
  });
}

async function switchNetwork(
  provider: Eip1193Provider,
  chainId: number,
) {
  const hexChainId = `0x${chainId.toString(16)}`;

  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [
      {
        chainId: hexChainId,
      },
    ],
  });
}

// ─── Wait for Circle attestation ─────────────────────────────────────────────

interface AttestationMessage {
  message: string;
  attestation: string;
  status: string;
}

async function waitForAttestation(
  sourceDomain: number,
  transactionHash: string,
): Promise<AttestationMessage> {
  const maxWaitMs = 20 * 60 * 1000;
  const pollIntervalMs = 5000;
  const startedAt = Date.now();

  const url =
    `https://iris-api-sandbox.circle.com/v2/messages/` +
    `${sourceDomain}?transactionHash=${transactionHash}`;

  while (Date.now() - startedAt < maxWaitMs) {
    try {
      const response = await fetch(url);

      if (response.status === 404) {
        await new Promise(resolve =>
          setTimeout(resolve, pollIntervalMs),
        );
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Circle attestation API returned HTTP ${response.status}`,
        );
      }

      const data = await response.json() as {
        messages?: AttestationMessage[];
      };

      const message = data.messages?.[0];

      if (
        message &&
        message.status === 'complete' &&
        message.message &&
        message.attestation
      ) {
        return message;
      }

      await new Promise(resolve =>
        setTimeout(resolve, pollIntervalMs),
      );
    } catch (error) {
      console.warn(
        '[bridge] Attestation polling error:',
        error,
      );

      await new Promise(resolve =>
        setTimeout(resolve, pollIntervalMs),
      );
    }
  }

  throw new Error(
    'Timed out waiting for Circle attestation.',
  );
}

// ─── Execute Bridge ─────────────────────────────────────────────────────────

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

    if (amount <= 0) {
      throw new Error(
        'Bridge amount must be greater than zero.',
      );
    }

    const destinationDomain =
      CCTP_V2.domains[
        toNetwork as keyof typeof CCTP_V2.domains
      ];

    if (destinationDomain === undefined) {
      throw new Error(
        `CCTP domain not configured for ${destination.name}.`,
      );
    }

    const sourceDomain =
      CCTP_V2.domains[
        fromNetwork as keyof typeof CCTP_V2.domains
      ];

    if (sourceDomain === undefined) {
      throw new Error(
        `CCTP domain not configured for ${source.name}.`,
      );
    }

    const usdcAddress = getUsdcAddress(fromNetwork);

    const account =
      walletAddress as `0x${string}`;

    // ─────────────────────────────────────────────────────────────────────
    // 1. Switch wallet to source network
    // ─────────────────────────────────────────────────────────────────────

    await switchNetwork(
      provider,
      source.chainId,
    );

    const publicClient = createPublicClient({
      transport: http(source.rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      transport: custom(provider),
    });

    // ─────────────────────────────────────────────────────────────────────
    // 2. Convert USDC amount
    // ─────────────────────────────────────────────────────────────────────

    const amountUnits = parseUnits(
      amount.toString(),
      6,
    );

    // ─────────────────────────────────────────────────────────────────────
    // 3. Approve TokenMessengerV2
    // ─────────────────────────────────────────────────────────────────────

    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [
        CCTP_V2.tokenMessenger,
        amountUnits,
      ],
    });

    const approveTx =
      await walletClient.sendTransaction({
        account,
        to: usdcAddress,
        data: approveData,
      });

    await publicClient.waitForTransactionReceipt({
      hash: approveTx,
    });

    // ─────────────────────────────────────────────────────────────────────
    // 4. Burn USDC through CCTP V2
    // ─────────────────────────────────────────────────────────────────────

    // bytes32(0) = any address may call receiveMessage
    const destinationCaller = pad('0x', {
      size: 32,
    });

    // Standard transfer
    const maxFee = 0n;
    const minFinalityThreshold = 2000;

    const burnData = encodeFunctionData({
      abi: TOKEN_MESSENGER_V2_ABI,
      functionName: 'depositForBurn',
      args: [
        amountUnits,
        destinationDomain,
        addressToBytes32(walletAddress),
        usdcAddress,
        destinationCaller,
        maxFee,
        minFinalityThreshold,
      ],
    });

    const burnTx =
      await walletClient.sendTransaction({
        account,
        to: CCTP_V2.tokenMessenger,
        data: burnData,
      });

    const burnReceipt =
      await publicClient.waitForTransactionReceipt({
        hash: burnTx,
      });

    if (burnReceipt.status !== 'success') {
      throw new Error(
        'USDC burn transaction failed.',
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. Ask Circle for the CCTP V2 message + attestation
    // ─────────────────────────────────────────────────────────────────────

    const attestation =
      await waitForAttestation(
        sourceDomain,
        burnTx,
      );

    // ─────────────────────────────────────────────────────────────────────
    // 6. Switch wallet to destination network
    // ─────────────────────────────────────────────────────────────────────

    await switchNetwork(
      provider,
      destination.chainId,
    );

    const destinationPublicClient =
      createPublicClient({
        transport: http(destination.rpcUrl),
      });

    const destinationWalletClient =
      createWalletClient({
        account,
        transport: custom(provider),
      });

    // ─────────────────────────────────────────────────────────────────────
    // 7. Receive message / mint USDC
    // ─────────────────────────────────────────────────────────────────────

    const receiveData = encodeFunctionData({
      abi: MESSAGE_TRANSMITTER_V2_ABI,
      functionName: 'receiveMessage',
      args: [
        attestation.message as `0x${string}`,
        attestation.attestation as `0x${string}`,
      ],
    });

    const mintTx =
      await destinationWalletClient.sendTransaction({
        account,
        to: CCTP_V2.messageTransmitter,
        data: receiveData,
      });

    const mintReceipt =
      await destinationPublicClient.waitForTransactionReceipt({
        hash: mintTx,
      });

    if (mintReceipt.status !== 'success') {
      throw new Error(
        'Destination mint transaction failed.',
      );
    }

    return {
      success: true,
      burnTxHash: burnTx,
      mintTxHash: mintTx,
      status: 'minted',
    };

  } catch (error) {
    return {
      success: false,
      status: 'burned',
      error:
        error instanceof Error
          ? error.message
          : 'Bridge transaction failed.',
    };
  }
}
