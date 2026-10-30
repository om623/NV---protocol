import type { Eip1193Provider } from './arc';
import type { WalletInfo } from './walletDiscovery';
import { NETWORKS_CONFIG } from '../networks';

const REOWN_PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID || 'a88bdd462a69fb89edc408296a75e91d';

type WalletConnectProvider = Eip1193Provider & {
  connect: () => Promise<string[]>;
  disconnect: () => Promise<void>;
};

type EthereumProviderModule = {
  default?: { init?: (options: Record<string, unknown>) => Promise<WalletConnectProvider> };
  EthereumProvider?: { init?: (options: Record<string, unknown>) => Promise<WalletConnectProvider> };
};

let providerPromise: Promise<WalletConnectProvider> | null = null;

/**
 * Load the provider only when the user chooses WalletConnect.
 * Use esm.sh's bundled ESM output so the provider and its modal dependencies
 * resolve together instead of relying on a graph of unbundled CDN imports.
 */
async function getWalletConnectProvider(): Promise<WalletConnectProvider> {
  if (!providerPromise) {
    providerPromise = (async () => {
      if (!REOWN_PROJECT_ID || REOWN_PROJECT_ID.length < 20) {
        throw new Error('O Reown Project ID não está configurado corretamente.');
      }

      const moduleUrl = 'https://esm.sh/@walletconnect/ethereum-provider@2.21.1?bundle&target=es2022';
      const module = await import(/* @vite-ignore */ moduleUrl) as EthereumProviderModule;
      const EthereumProvider = module.default ?? module.EthereumProvider;

      if (typeof EthereumProvider?.init !== 'function') {
        throw new Error('Não foi possível carregar o provider do WalletConnect. Recarregue a página e tente novamente.');
      }

      const configured = NETWORKS_CONFIG.filter(
        network => network.chainId > 0 && Boolean(network.rpcUrl) && !network.comingSoon,
      );
      const chainIds = [...new Set(configured.map(network => network.chainId))];
      const rpcMap = Object.fromEntries(configured.map(network => [network.chainId, network.rpcUrl]));
      const defaultChain = chainIds.includes(1) ? 1 : chainIds[0];

      if (!defaultChain) {
        throw new Error('Nenhuma rede EVM compatível está configurada para o WalletConnect.');
      }

      return await EthereumProvider.init({
        projectId: REOWN_PROJECT_ID,
        chains: [defaultChain],
        optionalChains: chainIds.filter(chainId => chainId !== defaultChain),
        rpcMap,
        showQrModal: true,
        metadata: {
          name: 'NV Protocol',
          description: 'Conexão multichain para o NV Protocol',
          url: window.location.origin,
          icons: [new URL('/favicon.ico', window.location.origin).toString()],
        },
      });
    })().catch(error => {
      providerPromise = null;
      const message = error instanceof Error ? error.message : String(error);
      if (/subscrib|relay|project.?id|unauthori[sz]ed|origin|domain/i.test(message)) {
        throw new Error(
          'O WalletConnect não conseguiu iniciar a sessão. Verifique se o domínio deste preview está autorizado no Reown Cloud e tente novamente.',
        );
      }
      throw new Error(message || 'Falha ao iniciar o WalletConnect.');
    });
  }
  return providerPromise;
}

export async function connectWalletConnect(): Promise<WalletInfo> {
  const provider = await getWalletConnectProvider();
  await provider.connect();
  const accounts = await provider.request({ method: 'eth_accounts' }) as string[];

  if (!accounts?.[0]) {
    throw new Error('A carteira não devolveu um endereço. Aprove a conexão na carteira e tente novamente.');
  }

  return {
    id: 'walletconnect',
    name: 'WalletConnect',
    rdns: 'com.walletconnect',
    provider,
  };
}
