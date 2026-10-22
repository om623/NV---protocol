import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, RefreshCw, Flame } from 'lucide-react';
import type { NetworkConfig } from '../networks';
import { getAllAssets, type MarketAsset } from '../lib/marketData';
import { fetchEquityQuotes, type EquityQuote } from '../lib/equities';

type ConverterGroup = 'fiat' | 'crypto' | 'commodities' | 'stocks';
type ConverterAsset = {
  symbol: string;
  name: string;
  group: ConverterGroup;
  usdPrice: number | null;
  source: string;
  live: boolean;
};

const usdPerUnit = (asset: MarketAsset) => asset.category === 'fiat' ? (asset.price > 0 ? 1 / asset.price : 0) : asset.price;
const money = (value: number, currency = 'USD') => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency, maximumFractionDigits: value < 0.01 ? 8 : 4,
}).format(value);

function mapEquity(quote: EquityQuote, fx: Map<string, number>): ConverterAsset {
  const ratePerUsd = fx.get(quote.currency) ?? (quote.currency === 'USD' ? 1 : 0);
  return {
    symbol: quote.symbol,
    name: quote.name,
    group: 'stocks',
    usdPrice: quote.price !== null && ratePerUsd > 0 ? quote.price / ratePerUsd : null,
    source: 'Yahoo Finance',
    live: quote.isLive && quote.price !== null && ratePerUsd > 0,
  };
}

export function DashboardConverter({ activeNetwork }: { activeNetwork: NetworkConfig }) {
  const [group, setGroup] = useState<ConverterGroup>('crypto');
  const [from, setFrom] = useState('BTC');
  const [to, setTo] = useState('USD');
  const [amount, setAmount] = useState('1');
  const [refreshKey, setRefreshKey] = useState(0);
  const [equities, setEquities] = useState<ConverterAsset[]>([]);
  const [gasPrice, setGasPrice] = useState<string | null>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const [gasError, setGasError] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey(v => v + 1), 120_000);
    return () => window.clearInterval(timer);
  }, []);

  const baseAssets = useMemo<ConverterAsset[]>(() => getAllAssets().flatMap((asset): ConverterAsset[] => {
    let group: ConverterGroup | null = null;
    if (asset.category === 'fiat') group = 'fiat';
    else if (asset.category === 'crypto' || asset.category === 'stablecoins') group = 'crypto';
    else if (asset.category === 'commodities') group = 'commodities';
    if (!group) return [];
    return [{
      symbol: asset.symbol,
      name: asset.name,
      group,
      usdPrice: usdPerUnit(asset),
      source: asset.dataSource ?? 'Global Markets',
      live: asset.isLive,
    }];
  }), [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const fx = new Map<string, number>();
      for (const asset of getAllAssets()) if (asset.category === 'fiat') fx.set(asset.symbol, asset.price);
      const [brQuotes, usQuotes] = await Promise.all([
        fetchEquityQuotes('pt-BR'),
        fetchEquityQuotes('en'),
      ]);
      if (cancelled) return;
      const merged = new Map<string, ConverterAsset>();
      [...brQuotes, ...usQuotes].forEach(q => merged.set(q.symbol, mapEquity(q, fx)));
      setEquities([...merged.values()]);
    };
    void load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const allAssets = useMemo(() => [...baseAssets, ...equities], [baseAssets, equities]);
  const available = useMemo(() => allAssets.filter(a => a.group === group), [allAssets, group]);
  const fromAsset = allAssets.find(a => a.symbol === from) ?? available[0];
  const toAsset = allAssets.find(a => a.symbol === to) ?? allAssets.find(a => a.symbol === 'USD');
  const canConvert = !!fromAsset?.usdPrice && !!toAsset?.usdPrice && fromAsset.usdPrice > 0 && toAsset.usdPrice > 0 && Number(amount) >= 0;
  const output = canConvert ? Number(amount || 0) * fromAsset!.usdPrice! / toAsset!.usdPrice! : null;

  useEffect(() => {
    if (!available.some(a => a.symbol === from)) setFrom(available[0]?.symbol ?? 'BTC');
    if (!allAssets.some(a => a.symbol === to)) setTo('USD');
  }, [group, allAssets, available, from, to]);

  useEffect(() => {
    let cancelled = false;
    const readGas = async () => {
      setGasLoading(true);
      setGasError(false);
      try {
        const response = await fetch(activeNetwork.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
        });
        if (!response.ok) throw new Error('RPC unavailable');
        const payload = await response.json() as { result?: string; error?: unknown };
        if (!payload.result || payload.error) throw new Error('Gas price unavailable');
        const raw = BigInt(payload.result);
        const decimals = activeNetwork.nativeCurrency.decimals;
        const nativePerGas = Number(raw) / (10 ** decimals);
        const formatted = activeNetwork.nativeCurrency.symbol === 'ETH'
          ? `${(Number(raw) / 1e9).toFixed(2)} Gwei`
          : `${nativePerGas.toExponential(3)} ${activeNetwork.nativeCurrency.symbol}/unidade`;
        if (!cancelled) setGasPrice(formatted);
      } catch {
        if (!cancelled) { setGasPrice(null); setGasError(true); }
      } finally {
        if (!cancelled) setGasLoading(false);
      }
    };
    void readGas();
    const timer = window.setInterval(() => void readGas(), 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeNetwork.id, activeNetwork.rpcUrl, activeNetwork.nativeCurrency.decimals, activeNetwork.nativeCurrency.symbol]);

  const selectClass = 'min-w-0 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/50';
  const tabs: [ConverterGroup, string][] = [
    ['crypto', 'Cripto & stablecoins'], ['fiat', 'Fiat'], ['commodities', 'Commodities'],
    ['stocks', 'Ações / ETFs'],
  ];
  return (
    <section className="w-full rounded-2xl border border-white/[0.06] bg-card/85 backdrop-blur-xl p-3 sm:p-4 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Conversor de mercado</h2>
          <p className="text-[10px] text-muted-foreground/55 mt-0.5">Cotações indicativas · Global Markets</p>
        </div>
        <RefreshCw size={14} className="text-primary/60" />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setGroup(key)}
            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-mono transition-colors ${group === key ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/40 text-muted-foreground hover:bg-secondary'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 items-center">
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-2.5">
          <label className="block text-[9px] text-muted-foreground/55 uppercase tracking-widest mb-1.5">Você tem</label>
          <input aria-label="Quantidade para converter" type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-full bg-transparent text-lg font-mono text-foreground outline-none mb-2" />
          <select aria-label="Ativo de origem" value={fromAsset?.symbol ?? from} onChange={e => setFrom(e.target.value)} className={`w-full ${selectClass}`}>
            {available.map(a => <option key={a.symbol} value={a.symbol}>{a.symbol} · {a.name}{a.usdPrice === null ? ' · sem cotação' : ''}</option>)}
          </select>
        </div>
        <button type="button" aria-label="Inverter ativos" onClick={() => { setFrom(to); setTo(from); }}
          className="justify-self-center rounded-full border border-border/50 bg-background p-2.5 text-primary hover:bg-primary/10 transition-colors">
          <ArrowLeftRight size={15} />
        </button>
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-2.5">
          <label className="block text-[9px] text-muted-foreground/55 uppercase tracking-widest mb-1.5">Valor estimado</label>
          <div className="text-lg font-mono font-semibold text-primary truncate mb-2" title={String(output ?? '')}>
            {output === null ? 'Cotação indisponível' : output.toLocaleString('pt-BR', { maximumFractionDigits: output < 0.01 ? 8 : 4 })}
          </div>
          <select aria-label="Ativo de destino" value={toAsset?.symbol ?? to} onChange={e => setTo(e.target.value)} className={`w-full ${selectClass}`}>
            {allAssets.map(a => <option key={a.symbol} value={a.symbol}>{a.symbol} · {a.name}{a.usdPrice === null ? ' · sem cotação' : ''}</option>)}
          </select>
          <div className="text-[9px] text-muted-foreground/45 mt-1.5">
            {toAsset?.symbol} · {output !== null && toAsset ? money(output * (toAsset.usdPrice ?? 0)) : '—'} equivalente
          </div>
        </div>
      </div>
      {group === 'stocks' && <p className="text-[9px] text-muted-foreground/45 mt-2">Ações, ETFs e FIIs selecionados; dados via Yahoo Finance podem sofrer atraso de mercado. O conversor não executa ordens.</p>}
      <div className="mt-3 border-t border-border/30 pt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
          <Flame size={13} className="text-orange-400" />
          <span>Gás · {activeNetwork.shortName}</span>
          <span className="text-muted-foreground/35">({activeNetwork.nativeCurrency.symbol})</span>
        </div>
        <div className="text-[11px] font-mono text-foreground">
          {gasLoading && !gasPrice ? 'Consultando rede…' : gasPrice ?? (gasError ? 'Preço indisponível via RPC' : '—')}
        </div>
      </div>
      <p className="text-[9px] leading-relaxed text-muted-foreground/40 mt-2">Estimativas informativas com base nas cotações disponíveis; não representam oferta de execução. Valores indisponíveis permanecem em branco.</p>
    </section>
  );
}
