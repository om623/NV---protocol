import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import { toast } from '@/hooks/use-toast';
import {
  type Eip1193Provider,
  type WalletBalances,
  getProvider,
  getAccounts,
  getChainId,
  ensureArcNetwork,
  ensureNetwork,
  networkChainParams,
  transferNative,
  transferErc20,
  getAllBalances,
  shortAddress,
  ARC_TOKENS,
} from '@/lib/arc';
import {
  type EnvMode,
  type NetworkConfig,
  DEFAULT_TESTNET,
  DEFAULT_MAINNET,
} from '@/networks';
import {
  type SimHistoryItem,
  type RoiPoint,
  getNextSimId,
  formatDateTime,
  generateReportHtml,
  PIPELINE_STEPS,
  CONSOLE_SCRIPT,
  SIM_TOTAL_MS,
  ROI_START_MS,
  ROI_DURATION_MS,
  ROI_TARGET,
} from './simulation';
import {
  type Transaction,
  type PendingSwap,
  MOCK_BALANCES,
  INITIAL_TRANSACTIONS,
  EXCHANGE_RATES,
} from './tokens';

/**
 * ─── NV Protocol — ProtocolProvider (central state) ──────────────────────────
 * All global state lives here: wallet, network/env, swap, simulation engine,
 * transactions, history, report export and the action handlers that mutate
 * them. Any module (Dashboard, Swap, Wallet, Pools, Simulation, Settings…)
 * consumes this context through useProtocol() — there is a single source of
 * truth and no duplicated logic anywhere in the app.
 *
 * Fase 1: this provider is mounted above the current Home render. The visual
 * behaviour is byte-for-byte identical — Home simply reads from the context
 * instead of owning local state.
 */

export interface ProtocolContextValue {
  // ── Swap state ─────────────────────────────────────────────────────────
  sourceToken: string;
  setSourceToken: (v: string) => void;
  destToken: string;
  setDestToken: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  swapModalOpen: boolean;
  setSwapModalOpen: (v: boolean) => void;
  swapStep: number;
  pendingSwap: PendingSwap | null;
  transactions: Transaction[];
  handleSwap: () => void;
  handleRealSwap: () => void;
  handleReverse: () => void;
  handleMax: () => void;
  closeSwapModal: () => void;

  // ── Wallet state ───────────────────────────────────────────────────────
  provider: Eip1193Provider | null;
  connectedAddress: string | null;
  realBalances: WalletBalances | null;
  isConnected: boolean;
  showDisconnect: boolean;
  setShowDisconnect: (v: boolean) => void;
  handleConnect: () => Promise<void>;
  handleDisconnect: () => void;

  // ── Env / network state ────────────────────────────────────────────────
  envMode: EnvMode;
  setEnvMode: (mode: EnvMode) => void;
  activeNetwork: NetworkConfig;
  setActiveNetwork: (network: NetworkConfig) => void;
  walletChainId: number | null;
  handleNetworkChange: (network: NetworkConfig) => void;
  handleSwitchNetwork: () => void;

  // ── Simulation state ───────────────────────────────────────────────────
  simId: string;
  simDateTime: string;
  simStep: number;
  simProgress: number;
  consoleLogs: { type: 'info' | 'success' | 'warn'; text: string }[];
  simPhase: 'pipeline' | 'complete';
  simStats: { balance: number; roi: number; risk: number; execTime: number; poolsAnalyzed: number; opportunities: number };
  simTotalTime: number;
  roiPoints: RoiPoint[];
  reportExported: boolean;
  simHistory: SimHistoryItem[];
  historyOpen: boolean;
  setHistoryOpen: (v: boolean) => void;
  simPaused: boolean;
  setSimPaused: (v: boolean) => void;
  handleNovaSimulacao: () => void;
  handleStartNewSim: () => void;
  handlePause: () => void;
  handleCancel: () => void;
  handleExportReport: () => void;

  // ── Shared refs ─────────────────────────────────────────────────────────
  consoleEndRef: React.RefObject<HTMLDivElement | null>;
}

const ProtocolContext = createContext<ProtocolContextValue | null>(null);

export function ProtocolProvider({ children }: { children: ReactNode }) {
  // ── Swap state ──────────────────────────────────────────────────────────
  const [sourceToken, setSourceToken] = useState('USDC');
  const [destToken, setDestToken] = useState('EURC');
  const [amount, setAmount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  // Real wallet state
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [realBalances, setRealBalances] = useState<WalletBalances | null>(null);

  // View + coming-soon state
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapStep, setSwapStep] = useState(0);
  const [pendingSwap, setPendingSwap] = useState<PendingSwap | null>(null);

  // ── Environment / network state ─────────────────────────────────────────
  const [envMode, setEnvMode] = useState<EnvMode>('testnet');
  const [activeNetwork, setActiveNetwork] = useState<NetworkConfig>(DEFAULT_TESTNET);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);

  // ── Simulation state ────────────────────────────────────────────────────
  const [simId, setSimId] = useState('');
  const [simDateTime, setSimDateTime] = useState('');
  const [simStep, setSimStep] = useState(-1);
  const [simProgress, setSimProgress] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<{ type: 'info' | 'success' | 'warn'; text: string }[]>([]);
  const [simPhase, setSimPhase] = useState<'pipeline' | 'complete'>('pipeline');
  const [simStats, setSimStats] = useState({ balance: 0, roi: 0, risk: 0, execTime: 0, poolsAnalyzed: 0, opportunities: 0 });
  const [simTotalTime, setSimTotalTime] = useState(0);
  const [roiPoints, setRoiPoints] = useState<RoiPoint[]>([]);
  const [reportExported, setReportExported] = useState(false);
  const [simHistory, setSimHistory] = useState<SimHistoryItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('vault-sim-history') || '[]'); } catch { return []; }
  });
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── UI state (new) ───────────────────────────────────────────────────────
  const [simPaused, setSimPaused] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const simTimers = useRef<{ intervals: number[]; timeouts: number[] }>({ intervals: [], timeouts: [] });
  const swapStepTimers = useRef<number[]>([]);
  const miscTimers = useRef<number[]>([]);

  // Centralised unmount cleanup — clears every timer that escapes clearSim.
  useEffect(() => {
    return () => {
      simTimers.current.intervals.forEach(t => window.clearInterval(t));
      simTimers.current.timeouts.forEach(t => window.clearTimeout(t));
      swapStepTimers.current.forEach(t => window.clearTimeout(t));
      miscTimers.current.forEach(t => window.clearTimeout(t));
    };
  }, []);

  // ── Simulation engine (unchanged) ────────────────────────────────────────

  const clearSim = useCallback(() => {
    simTimers.current.timeouts.forEach(t => window.clearTimeout(t));
    simTimers.current.intervals.forEach(t => window.clearInterval(t));
    swapStepTimers.current.forEach(t => window.clearTimeout(t));
    simTimers.current = { intervals: [], timeouts: [] };
    swapStepTimers.current = [];
  }, []);

  const startSim = useCallback((id: string, dt: string) => {
    const sto = (fn: () => void, ms: number) => {
      const t = window.setTimeout(fn, ms);
      simTimers.current.timeouts.push(t);
    };
    const sin = (fn: () => void, ms: number): number => {
      const t = window.setInterval(fn, ms);
      simTimers.current.intervals.push(t);
      return t;
    };
    const animateTo = (setter: (v: number) => void, target: number, duration: number, round = false) => {
      const s = Date.now();
      const iv = sin(() => {
        const t = Math.min(1, (Date.now() - s) / duration);
        const e = 1 - Math.pow(1 - t, 3);
        setter(round ? Math.round(target * e) : target * e);
        if (t >= 1) { window.clearInterval(iv); simTimers.current.intervals = simTimers.current.intervals.filter(x => x !== iv); }
      }, 30);
    };

    const startTime = Date.now();
    PIPELINE_STEPS.forEach((_, i) => sto(() => setSimStep(i), i * 950));
    CONSOLE_SCRIPT.forEach(({ type, text, delay }) =>
      sto(() => setConsoleLogs(prev => [...prev, { type, text }]), delay));

    const progIv = sin(() => {
      setSimProgress(Math.min(100, ((Date.now() - startTime) / SIM_TOTAL_MS) * 100));
    }, 50);
    const execIv = sin(() => {
      setSimStats(prev => ({ ...prev, execTime: (Date.now() - startTime) / 1000 }));
    }, 100);

    for (let ms = 0; ms <= SIM_TOTAL_MS; ms += 200) {
      const scheduledMs = ms;
      sto(() => {
        const roiT = scheduledMs < ROI_START_MS ? 0 : Math.min(1, (scheduledMs - ROI_START_MS) / ROI_DURATION_MS);
        const roiVal = ROI_TARGET * (1 - Math.pow(1 - roiT, 3));
        setRoiPoints(prev => [...prev, { t: scheduledMs, roi: roiVal }]);
      }, ms);
    }

    sto(() => animateTo(v => setSimStats(p => ({ ...p, balance: v })), 46382.17, 2200), 1400);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, poolsAnalyzed: v })), 23, 1400, true), 3500);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, opportunities: v })), 7, 800, true), 5000);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, risk: v })), 12.3, 900), 5800);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, roi: v })), ROI_TARGET, 1400), ROI_START_MS);

    sto(() => {
      const total = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
      window.clearInterval(progIv);
      window.clearInterval(execIv);
      simTimers.current.intervals = simTimers.current.intervals.filter(x => x !== progIv && x !== execIv);
      setSimTotalTime(total);
      setSimPhase('complete');
      setSimProgress(100);
      const item: SimHistoryItem = {
        id, datetime: dt, roi: ROI_TARGET, risk: 12.3, duration: total,
        strategy: 'Arbitrum Optimal Route v2', pools: 23, opportunities: 7,
        fromToken: '', toToken: '',
      };
      setSimHistory(prev => {
        const updated = [item, ...prev].slice(0, 10);
        try { localStorage.setItem('vault-sim-history', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }, SIM_TOTAL_MS);
  }, []);

  // Start / stop simulation with the swap modal.
  useEffect(() => {
    if (swapModalOpen) {
      const id = getNextSimId();
      const dt = formatDateTime(new Date());
      setSimId(id); setSimDateTime(dt);
      setSimStep(-1); setSimProgress(0); setConsoleLogs([]);
      setSimPhase('pipeline'); setRoiPoints([]);
      setSimStats({ balance: 0, roi: 0, risk: 0, execTime: 0, poolsAnalyzed: 0, opportunities: 0 });
      setSimTotalTime(0); setReportExported(false);
      startSim(id, dt);
    } else { clearSim(); }
    return clearSim;
  }, [swapModalOpen]);

  // ── Existing handlers (unchanged) ──────────────────────────────────────────

  const handleNetworkChange = useCallback((network: NetworkConfig) => {
    setActiveNetwork(network);
  }, []);

  const handleSwitchNetwork = useCallback(() => {
    setWalletChainId(activeNetwork.chainId);
  }, [activeNetwork.chainId]);

  const isRealSwap = isConnected && activeNetwork.type === 'testnet';

  const refreshBalances = useCallback(async (prov: Eip1193Provider, addr: string) => {
    try {
      const bal = await getAllBalances(prov, addr);
      setRealBalances(bal);
    } catch {
      // non-fatal
    }
  }, []);

  const handleConnect = useCallback(async () => {
    const prov = getProvider();
    if (!prov) {
      toast({ title: 'Carteira não encontrada', description: 'Instale MetaMask para conectar.', variant: 'destructive' });
      return;
    }
    try {
      const accounts = await getAccounts(prov);
      const addr = accounts?.[0];
      if (!addr) { toast({ title: 'Conta não autorizada', variant: 'destructive' }); return; }
      // Switch to the active testnet when applicable (supports all testnets).
      if (activeNetwork.type === 'testnet') {
        await ensureNetwork(prov, networkChainParams(activeNetwork));
      } else {
        await ensureArcNetwork(prov);
      }
      const chainId = await getChainId(prov);
      setProvider(prov);
      setConnectedAddress(addr);
      setIsConnected(true);
      setWalletChainId(chainId);
      await refreshBalances(prov, addr);
      toast({ title: 'Carteira conectada', description: `Endereço: ${shortAddress(addr)}` });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 4001) toast({ title: 'Conexão recusada', variant: 'destructive' });
      else toast({ title: 'Erro ao conectar', description: (err as Error)?.message, variant: 'destructive' });
    }
  }, [activeNetwork, refreshBalances]);

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    setProvider(null);
    setConnectedAddress(null);
    setRealBalances(null);
    setWalletChainId(null);
    setShowDisconnect(false);
  }, []);

  // ── Real swap via injected EIP-1193 provider (Arc Testnet) ─────────────────
  const handleRealSwap = useCallback(async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    const prov = provider ?? getProvider();
    if (!prov) {
      toast({ title: 'Carteira não encontrada', description: 'Conecte sua carteira MetaMask primeiro.', variant: 'destructive' });
      return;
    }
    try {
      const accounts = await getAccounts(prov);
      const from = accounts?.[0];
      if (!from) { toast({ title: 'Conta não autorizada', variant: 'destructive' }); return; }
      if (activeNetwork.type === 'testnet') {
        await ensureNetwork(prov, networkChainParams(activeNetwork));
      } else {
        await ensureArcNetwork(prov);
      }
      setWalletChainId(activeNetwork.chainId);

      const fromTokenCfg = ARC_TOKENS[sourceToken];
      let txHash: string;
      if (fromTokenCfg && !fromTokenCfg.isNative) {
        txHash = await transferErc20(prov, from, fromTokenCfg.address!, from, n, fromTokenCfg.decimals);
      } else {
        txHash = await transferNative(prov, from, from, n);
      }

      const rate = EXCHANGE_RATES[`${sourceToken}-${destToken}`] || 0;
      setPendingSwap({ fromToken: sourceToken, toToken: destToken, fromAmount: n, toAmount: n * rate });
      setTransactions(prev => [{
        id: txHash || Math.random().toString(),
        fromToken: sourceToken, toToken: destToken,
        fromAmount: n, toAmount: n * rate,
        time: 'Just now', status: 'Success',
      }, ...prev]);
      setAmount('');
      await refreshBalances(prov, from);
      toast({ title: `Swap real enviado na ${activeNetwork.name}!`, description: txHash ? `Tx: ${txHash.slice(0, 10)}…` : undefined });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 4001) toast({ title: 'Transação recusada', description: 'A carteira recusou a transação.', variant: 'destructive' });
      else toast({ title: 'Falha no swap real', description: (err as Error)?.message, variant: 'destructive' });
    }
  }, [amount, provider, activeNetwork, sourceToken, destToken, refreshBalances]);

  const handleSwap = useCallback(() => {
    if (isConnected && isRealSwap) {
      handleRealSwap();
      return;
    }
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    const rate = EXCHANGE_RATES[`${sourceToken}-${destToken}`] || 0;
    setPendingSwap({ fromToken: sourceToken, toToken: destToken, fromAmount: n, toAmount: n * rate });
    setSwapModalOpen(true); setSwapStep(0);
    swapStepTimers.current.forEach(t => window.clearTimeout(t));
    swapStepTimers.current = [];
    [800, 2000, 3500, 5500].forEach((ms, i) => {
      const t = window.setTimeout(() => setSwapStep(i + 1), ms);
      swapStepTimers.current.push(t);
    });
  }, [isConnected, isRealSwap, amount, sourceToken, destToken, handleRealSwap]);

  const closeSwapModal = useCallback(() => {
    setSwapModalOpen(false);
    if (pendingSwap) {
      setTransactions(prev => [{
        id: Math.random().toString(),
        fromToken: pendingSwap.fromToken, toToken: pendingSwap.toToken,
        fromAmount: pendingSwap.fromAmount, toAmount: pendingSwap.toAmount,
        time: 'Just now', status: 'Success',
      }, ...prev]);
    }
    setAmount('');
  }, [pendingSwap]);

  const handleNovaSimulacao = useCallback(() => {
    const id = getNextSimId(); const dt = formatDateTime(new Date());
    setSimId(id); setSimDateTime(dt);
    clearSim();
    setSimStep(-1); setSimProgress(0); setConsoleLogs([]);
    setSimPhase('pipeline'); setRoiPoints([]);
    setSimStats({ balance: 0, roi: 0, risk: 0, execTime: 0, poolsAnalyzed: 0, opportunities: 0 });
    setSimTotalTime(0); setReportExported(false);
    const t = window.setTimeout(() => startSim(id, dt), 60);
    simTimers.current.timeouts.push(t);
  }, [clearSim, startSim]);

  const handleExportReport = useCallback(() => {
    const html = generateReportHtml({
      simId, datetime: simDateTime, wallet: '0x8F4A...91C2',
      fromToken: pendingSwap?.fromToken || 'ETH',
      toToken:   pendingSwap?.toToken   || 'USDC',
      fromAmount: pendingSwap?.fromAmount || 0,
      toAmount:   pendingSwap?.toAmount   || 0,
      totalTime: simTotalTime,
      roi: simStats.roi, risk: simStats.risk,
      strategy: 'Arbitrum Optimal Route v2',
      pools: simStats.poolsAnalyzed, opportunities: simStats.opportunities,
    });
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
    setReportExported(true);
    const t = window.setTimeout(() => setReportExported(false), 2500);
    miscTimers.current.push(t);
  }, [simId, simDateTime, pendingSwap, simTotalTime, simStats]);

  const handleReverse = useCallback(() => {
    setSourceToken(destToken);
    setDestToken(sourceToken);
  }, [destToken, sourceToken]);

  const handleMax = useCallback(() => {
    const bal = realBalances
      ? (sourceToken === 'USDC' ? realBalances.usdc : sourceToken === 'EURC' ? realBalances.eurc : realBalances.eth)
      : MOCK_BALANCES[sourceToken];
    setAmount(bal.toString());
  }, [realBalances, sourceToken]);

  // ── New action handlers ──────────────────────────────────────────────────────

  const handleStartNewSim = useCallback(() => {
    setSimPaused(false);
    if (!swapModalOpen) {
      const n = parseFloat(amount) || 1;
      const rate = EXCHANGE_RATES[`${sourceToken}-${destToken}`] || 0;
      setPendingSwap({ fromToken: sourceToken, toToken: destToken, fromAmount: n, toAmount: n * rate });
      setSwapModalOpen(true);
    } else {
      handleNovaSimulacao();
    }
  }, [swapModalOpen, amount, sourceToken, destToken, handleNovaSimulacao]);

  const handlePause = useCallback(() => {
    if (!swapModalOpen || simPhase === 'complete') return;
    if (simPaused) {
      setSimPaused(false);
      handleNovaSimulacao();
    } else {
      clearSim();
      setSimPaused(true);
    }
  }, [swapModalOpen, simPhase, simPaused, handleNovaSimulacao, clearSim]);

  const handleCancel = useCallback(() => {
    setSimPaused(false);
    closeSwapModal();
  }, [closeSwapModal]);

  const value = useMemo<ProtocolContextValue>(
    () => ({
      sourceToken, setSourceToken,
      destToken, setDestToken,
      amount, setAmount,
      swapModalOpen, setSwapModalOpen,
      swapStep,
      pendingSwap,
      transactions,
      handleSwap, handleRealSwap, handleReverse, handleMax, closeSwapModal,

      provider, connectedAddress, realBalances, isConnected, showDisconnect, setShowDisconnect,
      handleConnect, handleDisconnect,

      envMode, setEnvMode, activeNetwork, setActiveNetwork, walletChainId,
      handleNetworkChange, handleSwitchNetwork,

      simId, simDateTime, simStep, simProgress, consoleLogs, simPhase, simStats,
      simTotalTime, roiPoints, reportExported, simHistory, historyOpen, setHistoryOpen,
      simPaused, setSimPaused,
      handleNovaSimulacao, handleStartNewSim, handlePause, handleCancel, handleExportReport,
      consoleEndRef,
    }),
    [
      sourceToken, setSourceToken, destToken, setDestToken, amount, setAmount,
      swapModalOpen, setSwapModalOpen, swapStep, pendingSwap, transactions,
      handleSwap, handleRealSwap, handleReverse, handleMax, closeSwapModal,
      provider, connectedAddress, realBalances, isConnected, showDisconnect, setShowDisconnect,
      handleConnect, handleDisconnect,
      envMode, setEnvMode, activeNetwork, setActiveNetwork, walletChainId,
      handleNetworkChange, handleSwitchNetwork,
      simId, simDateTime, simStep, simProgress, consoleLogs, simPhase, simStats,
      simTotalTime, roiPoints, reportExported, simHistory, historyOpen, setHistoryOpen,
      simPaused, setSimPaused, handleNovaSimulacao, handleStartNewSim, handlePause, handleCancel, handleExportReport,
      consoleEndRef,
    ],
  );

  return <ProtocolContext.Provider value={value}>{children}</ProtocolContext.Provider>;
}

export function useProtocol(): ProtocolContextValue {
  const ctx = useContext(ProtocolContext);
  if (!ctx) throw new Error('useProtocol must be used within <ProtocolProvider>');
  return ctx;
}

