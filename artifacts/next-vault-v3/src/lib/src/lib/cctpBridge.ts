import { encodeFunctionData } from 'viem';
import type { Eip1193Provider } from './arc';

// ─── Circle CCTP V2 ─────────────────────────────────────────────────────────

const CCTP_TOKEN_MESSENGER_V2 =
  '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';

const CCTP_MESSAGE_TRANSMITTER_V2 =
  '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';

const CCTP_ATTESTATION_API =
  'https://iris-api-sandbox.circle.com/v2/messages';

// ─── Supported CCTP networks ────────────────────────────────────────────────

export interface CctpNetwork {
  id: string;
  name: string;
  chainId: number;
  domain: number;
  usdc: string;
  rpcUrl: string;
  explorerUrl: string;
}

export const CCTP_NETWORKS: Record<string, CctpNetwork> = {
  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    chainId: 5042002,
    domain: 26,
    usdc: '0x3600000000000000000000000000000000000000',
    rpcUrl: 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.arcscan.app',
  },

  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    domain: 6,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia-explorer.base.org',
  },
};

// ─── Types ──────────────────────────────────────────────────────────────────

export type CctpTransferStatus =
  | 'preparing'
  | 'approving'
  | 'burning'
  | 'waiting-attestation'
  | 'minting'
  | 'completed'
  | 'failed';

export interface CctpTransferResult {
  status: CctpTransferStatus;
  sourceTxHash?: string;
  destinationTxHash?: string;
  error?: string;
}

interface AttestationResponse {
  messages?: Array<{
    message: string;
    attestation: string;
    status: string;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addressToBytes32(address: string): `0x${string}` {
  return `0x${address.slice(2).padStart(64, '0')}` as `0x${string}`;
}

function uint256(value: bigint): `0x${string}` {
  return `0x${value.toString(16).padStart(64, '0')}` as `0x${string}`;
}

async function waitForReceipt(
  provider: Eip1193Provider,
  txHash: string,
  timeoutMs = 120_000,
): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });

    if (receipt) {
      const status =
        typeof receipt === 'object' && receipt !== null
          ? (receipt as { status?: string }).status
          : undefined;

      if (status === '0x0') {
        throw new Error('Transaction reverted on-chain.');
      }

      return;
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Timed out waiting for transaction confirmation.');
}

// ─── ERC-20 approve ──────────────────────────────────────────────────────────

async function approveUSDC(
  provider: Eip1193Provider,
  owner: string,
  amount: bigint,
  usdcAddress: string,
): Promise<string> {
  const data = encodeFunctionData({
    abi: [
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
    ],
    functionName: 'approve',
    args: [
      CCTP_TOKEN_MESSENGER_V2 as `0x${string}`,
      amount,
    ],
  });

  return (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: owner,
        to: usdcAddress,
        data,
      },
    ],
  })) as string;
}

// ─── CCTP V2 burn ───────────────────────────────────────────────────────────

async function depositForBurn(
  provider: Eip1193Provider,
  owner: string,
  amount: bigint,
  destination: CctpNetwork,
  source: CctpNetwork,
): Promise<string> {
  const data = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'depositForBurn',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'amount', type: 'uint256' },
          { name: 'destinationDomain', type: 'uint32' },
          { name: 'mintRecipient', type: 'bytes32' },
          { name: 'burnToken', type: 'address' },
          { name: 'destinationCaller', type: 'bytes32' },
          { name: 'maxFee', type: 'uint256' },
          { name: 'minFinalityThreshold', type: 'uint32' },
        ],
        outputs: [],
      },
    ],
    functionName: 'depositForBurn',
    args: [
      amount,
      destination.domain,
      addressToBytes32(owner),
      source.usdc as `0x${string}`,
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      0n,
      2000,
    ],
  });

  return (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: owner,
        to: CCTP_TOKEN_MESSENGER_V2,
        data,
      },
    ],
  })) as string;
}

// ─── Circle attestation ──────────────────────────────────────────────────────

async function waitForAttestation(
  sourceDomain: number,
  burnTxHash: string,
  timeoutMs = 1_500_000,
): Promise<{ message: string; attestation: string }> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const url =
      `${CCTP_ATTESTATION_API}/${sourceDomain}` +
      `?transactionHash=${burnTxHash}`;

    const response = await fetch(url);

    if (response.ok) {
      const data =
        (await response.json()) as AttestationResponse;

      const message = data.messages?.[0];

      if (
        message &&
        message.status === 'complete' &&
        message.attestation &&
        message.message
      ) {
        return {
          message: message.message,
          attestation: message.attestation,
        };
      }
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error(
    'Circle attestation was not available within the expected time.',
  );
}

// ─── Mint on destination ─────────────────────────────────────────────────────

async function receiveMessage(
  provider: Eip1193Provider,
  message: string,
  attestation: string,
  destination: CctpNetwork,
  owner: string,
): Promise<string> {
  const data = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'receiveMessage',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'message', type: 'bytes' },
          { name: 'attestation', type: 'bytes' },
        ],
        outputs: [],
      },
    ],
    functionName: 'receiveMessage',
    args: [
      message as `0x${string}`,
      attestation as `0x${string}`,
    ],
  });

  return (await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from: owner,
        to: CCTP_MESSAGE_TRANSMITTER_V2,
        data,
      },
    ],
  })) as string;
}

// ─── Main bridge operation ───────────────────────────────────────────────────

export async function executeCctpBridge(
  provider: Eip1193Provider,
  owner: string,
  fromNetworkId: string,
  toNetworkId: string,
  amount: number,
  onStatus?: (status: CctpTransferStatus) => void,
): Promise<CctpTransferResult> {
  try {
    const source = CCTP_NETWORKS[fromNetworkId];
    const destination = CCTP_NETWORKS[toNetworkId];

    if (!source || !destination) {
      throw new Error('CCTP route is not supported.');
    }

    if (source.id === destination.id) {
      throw new Error('Source and destination networks must be different.');
    }

    if (amount <= 0) {
      throw new Error('Bridge amount must be greater than zero.');
    }

    const amountUnits = BigInt(
      Math.round(amount * 1_000_000),
    );

    // ── 1. Ensure source network ────────────────────────────────────────────

    onStatus?.('preparing');

    const currentChain = await provider.request({
      method: 'eth_chainId',
    });

    const currentChainId =
      typeof currentChain === 'string'
        ? parseInt(currentChain, 16)
        : Number(currentChain);

    if (currentChainId !== source.chainId) {
      throw new Error(
        `Wallet is not connected to ${source.name}.`,
      );
    }

    // ── 2. Approve ───────────────────────────────────────────────────────────

    onStatus?.('approving');

    const approvalTx = await approveUSDC(
      provider,
      owner,
      amountUnits,
      source.usdc,
    );

    await waitForReceipt(provider, approvalTx);

    // ── 3. Burn ──────────────────────────────────────────────────────────────

    onStatus?.('burning');

    const burnTx = await depositForBurn(
      provider,
      owner,
      amountUnits,
      destination,
      source,
    );

    await waitForReceipt(provider, burnTx);

    // ── 4. Wait for Circle attestation ──────────────────────────────────────

    onStatus?.('waiting-attestation');

    const attestation = await waitForAttestation(
      source.domain,
      burnTx,
    );

    // ── 5. Destination network must be active ───────────────────────────────

    onStatus?.('minting');

    const destinationChainHex =
      '0x' + destination.chainId.toString(16);

    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [
        {
          chainId: destinationChainHex,
        },
      ],
    });

    const mintTx = await receiveMessage(
      provider,
      attestation.message,
      attestation.attestation,
      destination,
      owner,
    );

    await waitForReceipt(provider, mintTx);

    onStatus?.('completed');

    return {
      status: 'completed',
      sourceTxHash: burnTx,
      destinationTxHash: mintTx,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    onStatus?.('failed');

    return {
      status: 'failed',
      error: message,
    };
  }
}
