import type { Eip1193Provider } from './arc';
import type { WalletInfo } from './walletDiscovery';
import { NETWORKS_CONFIG } from '../networks';

const REOWN_PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID || 'a88bdd462a69fb89edc408296a75e91d';

type WalletConnectProvider = Eip1193Provider & {
  connect: () => Promise<string[]>;
  disconnect: () => Promise<void>;
};

let providerPromise: Promise<WalletConnectProvider> | null = null;

/**
 * Lazily loads WalletConnect's EIP-1193 provider only when the user chooses it.
 * The existing wallet connection pipeline remains the source of truth for NV Protocol.
 */
async function getWalletConnectProvider(): Promise<WalletConnectProvider> {
  if (!providerPromise) {
    providerPromise = (async () => {
      const moduleUrl = 'https://esm.sh/@walletconnect/ethereum-provider@2.21.1';
      // @vite-ignore keeps Vite from trying to bundle a runtime CDN module.
      const module = await import(/* @vite-ignore */ moduleUrl) as {
        default?: { init: (options: Record<string, unknown>) => Promise<WalletConnectProvider> };
        EthereumProvider?: { init: (options: Record<string, unknown>) => Promise<WalletConnectProvider> };
      };
      const EthereumProvider = module.default ?? module.EthereumProvider;
      if (!EthereumProvider?.init) throw new Error('WalletConnect provider could not be loaded.');

      const configured = NETWORKS_CONFIG.filter(network => network.chainId > 0 && network.rpcUrl && !network.comingSoon);
      const chainIds = [...new Set(configured.map(network => network.chainId))];
      const rpcMap = Object.fromEntries(configured.map(network => [network.chainId, network.rpcUrl]));
      const defaultChain = chainIds.includes(1) ? 1 : chainIds[0];
      if (!defaultChain) throw new Error('No supported EVM networks are configured.');

      return EthereumProvider.init({
        projectId: REOWN_PROJECT_ID,
        chains: [defaultChain],
        optionalChains: chainIds.filter(chainId => chainId !== defaultChain),
        rpcMap,
        showQrModal: true,
        metadata: {
          name: 'NV Protocol',
          description: 'Multichain wallet connection for NV Protocol',
          url: window.location.origin,
          icons: [new URL('/favicon.ico', window.location.origin).toString()],
        },
      });
    })().catch(error => {
      providerPromise = null;
      throw error;
    });
  }
  return providerPromise;
}

export async function connectWalletConnect(): Promise<WalletInfo> {
  const provider = await getWalletConnectProvider();
  await provider.connect();
  const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
  if (!accounts?.[0]) throw new Error('WalletConnect connected without returning an account.');
  return {
    id: 'walletconnect',
    name: 'WalletConnect',
    rdns: 'com.walletconnect',
    provider,
  };
}
