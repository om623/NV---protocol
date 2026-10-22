import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, RefreshCw, Flame } from 'lucide-react';
import type { NetworkConfig } from '../networks';
import { getAllAssets, type MarketAsset } from '../lib/marketData';

type ConverterGroup = 'fiat' | 'crypto' | 'commodities';
const groupOf = (asset: MarketAsset): ConverterGroup | null => {
  if (asset.category === 'fiat') return 'fiat';
  if (asset.category === 'crypto' || asset.category === 'stablecoins') return 'crypto';
  if (asset.category === 'commodities') return 'commodities';
  return null;
};
const usdPerUnit = (asset: MarketAsset) => asset.category === 'fiat' ? (asset.price > 0 ? 1 / asset.price : 0) : asset.price;
const money = (value: number, currency = 'USD') => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency, maximumFractionDigits: value < 0.01 ? 8 : 4,
}).format(value);

export function DashboardConverter({ activeNetwork }: { activeNetwork: NetworkConfig }) {
  const [group, setGroup] = useState<ConverterGroup>('crypto');
  const [from, setFrom] = useState('BTC');
  const [to, setTo] = useState('USD');
  const [amount, setAmount] = useState('1');
  const [refreshKey, setRefreshKey] = useState(0);
  const [gasPrice, setGasPrice] = useState<string | null>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const [gasError, setGasError] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey(v => v + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const assets = useMemo(() => getAllAssets().filter(a => groupOf(a) !== null), [refreshKey]);
  const available = useMemo(() => assets.filter(a => groupOf(a) === group), [assets, group]);
  const fromAsset = assets.find(a => a.symbol === from) ?? available[0];
  const toAsset = assets.find(a => a.symbol === to) ?? assets.find(a => a.symbol === 'USD');
  const output = Number(amount) >= 0 && fromAsset && toAsset && usdPerUnit(toAsset) > 0
    ? Number(amount || 0) * usdPerUnit(fromAsset) / usdPerUnit(toAsset)
    : 0;

  useEffect(() => {
    if (!available.some(a => a.symbol === from)) setFrom(available[0]?.symbol ?? 'BTC');
    if (!assets.some(a => a.symbol === to)) setTo('USD');
  }, [group, assets, available, from, to]);

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
  return (
    <section className="w-full rounded-2xl border border-white/[0.06] bg-card/85 backdrop-blur-xl p-3 sm:p-4 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Conversor de mercado</h2>
          <p className="text-[10px] text-muted-foreground/55 mt-0.5">Cotações indicativas de Global Markets</p>
        </div>
        <RefreshCw size={14} className="text-primary/60" />
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {([
          ['crypto', 'Cripto & stablecoins'],
          ['fiat', 'Fiat'],
          ['commodities', 'Commodities'],
        ] as [ConverterGroup, string][]).map(([key, label]) => (
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
          <select aria-label="Moeda de origem" value={fromAsset?.symbol ?? from} onChange={e => setFrom(e.target.value)} className={`w-full ${selectClass}`}>
            {available.map(a => <option key={a.symbol} value={a.symbol}>{a.symbol} · {a.name}</option>)}
          </select>
        </div>
        <button type="button" aria-label="Inverter moedas" onClick={() => { setFrom(to); setTo(from); }}
          className="justify-self-center rounded-full border border-border/50 bg-background p-2.5 text-primary hover:bg-primary/10 transition-colors">
          <ArrowLeftRight size={15} />
        </button>
        <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-2.5">
          <label className="block text-[9px] text-muted-foreground/55 uppercase tracking-widest mb-1.5">Valor estimado</label>
          <div className="text-lg font-mono font-semibold text-primary truncate mb-2" title={String(output)}>{fromAsset && toAsset ? output.toLocaleString('pt-BR', { maximumFractionDigits: output < 0.01 ? 8 : 4 }) : '—'}</div>
          <select aria-label="Moeda de destino" value={toAsset?.symbol ?? to} onChange={e => setTo(e.target.value)} className={`w-full ${selectClass}`}>
            {assets.map(a => <option key={a.symbol} value={a.symbol}>{a.symbol} · {a.name}</option>)}
          </select>
          <div className="text-[9px] text-muted-foreground/45 mt-1.5">{toAsset?.symbol} · {toAsset && money(output * usdPerUnit(toAsset))} equivalente</div>
        </div>
      </div>
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
      <p className="text-[9px] leading-relaxed text-muted-foreground/40 mt-2">Estimativa baseada nas cotações carregadas pelo Global Markets; não é uma oferta de execução. Ações individuais ainda não têm uma fonte de cotação integrada. O preço do gás depende da disponibilidade pública do RPC selecionado.</p>
    </section>
  );
}
