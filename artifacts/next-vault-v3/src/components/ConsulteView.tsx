import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Loader as Loader2, RefreshCw, Search, Send, ShieldCheck, WalletCards } from 'lucide-react';
import type { Eip1193Provider } from '../lib/arc';
import { getAllBalances, getTokensForNetwork, shortAddress, transferErc20, transferNative } from '../lib/arc';
import type { NetworkConfig } from '../networks';
import { getAsset } from '../lib/marketData';
import { useFormat } from '../i18n';

interface ConsulteViewProps {
  provider: Eip1193Provider | null;
  connectedAddress: string | null;
  explorerUrl: string;
  activeNetwork: NetworkConfig;
  walletName?: string | null;
}

function validAddress(value: string) { return /^0x[0-9a-fA-F]{40}$/.test(value.trim()); }

export function ConsulteView({ provider, connectedAddress, explorerUrl, activeNetwork, walletName }: ConsulteViewProps) {
  const fmt = useFormat();
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [copied, setCopied] = useState(false);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [sendError, setSendError] = useState('');

  const tokenMap = useMemo(() => getTokensForNetwork(activeNetwork), [activeNetwork]);
  const tokens = useMemo(() => Object.entries(tokenMap).map(([symbol, config]) => ({
    symbol, config, price: getAsset(symbol)?.price ?? 0,
  })), [tokenMap]);

  const refresh = useCallback(async () => {
    if (!provider || !connectedAddress) return;
    setLoading(true); setLoadError('');
    try { setBalances(await getAllBalances(provider, connectedAddress, tokenMap)); }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Não foi possível consultar os saldos.'); }
    finally { setLoading(false); }
  }, [provider, connectedAddress, tokenMap]);

  useEffect(() => { setBalances({}); setTxHash(''); setReviewing(false); if (provider && connectedAddress) void refresh(); }, [provider, connectedAddress, activeNetwork.id, refresh]);

  const total = tokens.reduce((sum, item) => sum + (balances[item.symbol] ?? 0) * item.price, 0);
  const usdc = tokenMap.USDC;
  const usdcBalance = balances.USDC ?? 0;
  const amountNumber = Number(amount.replace(',', '.'));
  const canSend = !!provider && !!connectedAddress && !!usdc && validAddress(to) && amountNumber > 0 && amountNumber <= usdcBalance;

  async function send() {
    if (!canSend || !provider || !connectedAddress || !usdc) return;
    setSending(true); setSendError('');
    try {
      const hash = usdc.address
        ? await transferErc20(provider, connectedAddress, usdc.address, to.trim(), amountNumber, usdc.decimals)
        : await transferNative(provider, connectedAddress, to.trim(), amountNumber);
      setTxHash(hash); setReviewing(false); setAmount(''); setTo(''); await refresh();
    } catch (e) { setSendError(e instanceof Error ? e.message : 'A transferência não foi concluída.'); }
    finally { setSending(false); }
  }

  if (!provider || !connectedAddress) {
    return (
      <section className="w-full rounded-2xl border border-primary/15 bg-card p-7 shadow-lg">
        <div className="flex items-center gap-3 mb-5"><div className="rounded-xl border border-primary/20 bg-primary/10 p-3"><Search size={22} className="text-primary"/></div><div><h2 className="text-xl font-semibold">Consulte</h2><p className="text-xs text-muted-foreground">Visão inteligente dos seus ativos</p></div></div>
        <div className="rounded-2xl border border-border/50 bg-secondary/20 p-6 text-center">
          <WalletCards size={30} className="mx-auto mb-3 text-primary"/>
          <h3 className="font-semibold mb-2">Sua visão financeira começa com a conexão</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">Conecte sua carteira pelo botão no canto superior direito. O Consulte exibirá seus saldos, valor estimado dos ativos e disponibilizará transferências com revisão antes do envio.</p>
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-primary"><ShieldCheck size={14}/> A conexão continua sob seu controle e sua carteira permanece não custodial.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full space-y-4">
      <div className="rounded-2xl border border-primary/15 bg-card p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><Search size={17} className="text-primary"/><h2 className="text-lg font-semibold">Consulte</h2></div><p className="mt-1 text-xs text-muted-foreground">{walletName ? walletName + ' · ' : ''}{activeNetwork.name}</p></div>
          <button onClick={() => void refresh()} disabled={loading} className="rounded-xl border border-border px-3 py-2 text-xs hover:bg-secondary disabled:opacity-50">{loading ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>}</button>
        </div>
        <div className="mt-4 rounded-xl bg-secondary/25 p-3 flex items-center justify-between gap-3">
          <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Endereço conectado</div><div className="font-mono text-sm mt-1">{shortAddress(connectedAddress)}</div></div>
          <div className="flex gap-1">
            <button onClick={async()=>{await navigator.clipboard.writeText(connectedAddress);setCopied(true);setTimeout(()=>setCopied(false),1500)}} className="p-2 rounded-lg hover:bg-secondary">{copied?<Check size={14}/>:<Copy size={14}/>}</button>
            <a href={explorerUrl+'/address/'+connectedAddress} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-secondary"><ExternalLink size={14}/></a>
          </div>
        </div>
        <div className="mt-5"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Patrimônio consultado</div><div className="text-3xl font-semibold font-mono mt-1">{fmt.currency(total)}</div>{loadError && <p className="text-xs text-red-400 mt-2">{loadError}</p>}</div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Saldos por ativo</h3><span className="text-[10px] text-muted-foreground">{tokens.length} ativos monitorados</span></div>
        <div className="space-y-2">{tokens.map(({symbol,config,price})=>{const value=balances[symbol]??0;return <div key={symbol} className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/20 p-3"><div><div className="font-mono font-semibold">{symbol}</div><div className="text-[10px] text-muted-foreground">{price>0?fmt.currency(price):'Preço indisponível'}</div></div><div className="text-right"><div className="font-mono">{fmt.number(value,config.decimals)}</div><div className="text-[10px] text-muted-foreground">{fmt.currency(value*price)}</div></div></div>})}</div>
      </div>

      {usdc && <div className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2 mb-1"><Send size={15} className="text-primary"/><h3 className="font-semibold">Transferir USDC</h3></div>
        <p className="text-xs text-muted-foreground mb-4">Revise destino e valor antes de solicitar a assinatura da carteira.</p>
        <label className="text-[10px] uppercase text-muted-foreground">Destino</label><input value={to} onChange={e=>{setTo(e.target.value);setReviewing(false)}} placeholder="0x..." className="mt-1 mb-3 w-full rounded-xl border border-border bg-secondary/20 px-3 py-2.5 font-mono text-xs outline-none focus:border-primary/40"/>
        <div className="flex justify-between"><label className="text-[10px] uppercase text-muted-foreground">Valor</label><span className="text-[10px] text-muted-foreground">Disponível: {fmt.number(usdcBalance,6)} USDC</span></div>
        <input value={amount} onChange={e=>{setAmount(e.target.value);setReviewing(false)}} inputMode="decimal" placeholder="0.00" className="mt-1 mb-3 w-full rounded-xl border border-border bg-secondary/20 px-3 py-2.5 font-mono text-xs outline-none focus:border-primary/40"/>
        {!reviewing ? <button disabled={!canSend} onClick={()=>setReviewing(true)} className="w-full rounded-xl bg-primary/10 border border-primary/20 py-2.5 text-sm font-semibold text-primary disabled:opacity-30">Revisar transferência</button>:
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"><p className="text-xs">Enviar <b>{amountNumber} USDC</b> para <span className="font-mono break-all">{to}</span>.</p><div className="flex gap-2 mt-3"><button onClick={()=>setReviewing(false)} className="flex-1 rounded-lg border border-border py-2 text-xs">Editar</button><button disabled={sending} onClick={()=>void send()} className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground">{sending?'Enviando…':'Confirmar na carteira'}</button></div></div>}
        {sendError && <p className="text-xs text-red-400 mt-3">{sendError}</p>}
        {txHash && <a href={explorerUrl+'/tx/'+txHash} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1 text-xs text-emerald-400"><Check size={12}/> Transferência enviada · ver transação <ExternalLink size={11}/></a>}
      </div>}
    </section>
  );
}
