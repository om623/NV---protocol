import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, BookOpen, ChevronRight, Clock3, Copy, Download, ExternalLink, FileText, Mail, Palette, Settings2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { clearNVActivity, logNVActivity, readNVActivity, type NVActivity } from '../lib/activityLog';
import { useI18n } from '../i18n/context';

const panel = 'rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm';
const titleClass = 'text-lg font-semibold text-foreground';
const subtle = 'text-sm text-muted-foreground';

function useActivityFeed() {
  const [items, setItems] = useState<NVActivity[]>(() => readNVActivity());
  useEffect(() => {
    const refresh = () => setItems(readNVActivity());
    window.addEventListener('nv-activity-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('nv-activity-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return [items, setItems] as const;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(timestamp);
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function HistoryModule() {
  const [items] = useActivityFeed();
  const hashes = items.filter(item => item.txHash);
  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      logNVActivity({ category: 'system', action: 'Hash copiado', details: hash });
    } catch {
      // The hash remains visible for manual copying when clipboard access is unavailable.
    }
  };
  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-primary mb-2"><Clock3 size={18} /><span className="text-xs uppercase tracking-[0.2em] font-mono">NV Protocol</span></div>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className={subtle + ' mt-1'}>Hashes de transações registradas neste navegador.</p>
      </div>
      <div className={panel}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div><h2 className={titleClass}>Hashes registrados</h2><p className={subtle + ' mt-1'}>{hashes.length} hash(es) encontrados</p></div>
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><ShieldCheck size={20} /></div>
        </div>
        {hashes.length === 0 ? <EmptyState>Nenhum hash registrado ainda. Após uma transação confirmada, o NV Protocol poderá exibi-lo aqui neste dispositivo.</EmptyState> : (
          <div className="space-y-3">
            {hashes.map(item => (
              <div key={item.id} className="rounded-xl border border-border/60 bg-background/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-sm">{item.action}</div>
                  <span className="text-xs text-muted-foreground">{formatDate(item.timestamp, localeBcp47)}</span>
                </div>
                <div className="mt-2 break-all font-mono text-xs text-muted-foreground">{item.txHash}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={() => void copyHash(item.txHash!)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary"><Copy size={13}/> Copiar hash</button>
                  {item.network && <span className="text-xs text-muted-foreground">{item.network}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function ReportsModule() {
  const [items] = useActivityFeed();
  const [filter, setFilter] = useState('all');
  const filtered = useMemo(() => filter === 'all' ? items : items.filter(item => item.category === filter), [items, filter]);
  const counts = useMemo(() => ({
    total: items.length,
    tx: items.filter(item => item.txHash).length,
    agent: items.filter(item => item.category === 'agent' || item.category === 'news').length,
    markets: items.filter(item => item.category === 'markets').length,
  }), [items]);
  const exportReport = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), product: 'NV Protocol', activity: filtered }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nv-protocol-relatorio.json';
    anchor.click();
    URL.revokeObjectURL(url);
    logNVActivity({ category: 'system', action: 'Relatório exportado', details: `${filtered.length} registros` });
  };
  const clearReport = () => {
    if (window.confirm('Apagar o histórico de atividades salvo neste navegador? Esta ação não pode ser desfeita.')) clearNVActivity();
  };
  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-primary mb-2"><FileText size={18}/><span className="text-xs uppercase tracking-[0.2em] font-mono">NV Protocol</span></div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className={subtle + ' mt-1'}>Registro local de ações do app, com exportação para auditoria pessoal.</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[['Ações registradas', counts.total], ['Hashes de transação', counts.tx], ['NV Agent / News', counts.agent], ['Global Markets', counts.markets]].map(([label, value]) => <div key={String(label)} className={panel}><div className="text-xs text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-bold tabular-nums">{value}</div></div>)}
      </div>
      <div className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h2 className={titleClass}>Registro de atividade</h2><p className={subtle + ' mt-1'}>Inclui navegação, carteira, swaps/bridges confirmados, agente e mercados conforme os eventos integrados.</p></div><div className="flex gap-2"><button onClick={exportReport} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Download size={14}/> Exportar JSON</button><button onClick={clearReport} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs hover:bg-secondary"><Trash2 size={14}/> Limpar</button></div></div>
        <label className="text-xs text-muted-foreground">Filtrar registros</label>
        <select value={filter} onChange={event => setFilter(event.target.value)} className="mt-1 mb-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
          <option value="all">Todas as categorias</option><option value="wallet">Carteira</option><option value="swap">Swap</option><option value="bridge">Bridge</option><option value="agent">NV Agent</option><option value="news">NV News</option><option value="markets">Global Markets</option><option value="navigation">Navegação</option><option value="system">Sistema</option>
        </select>
        {filtered.length === 0 ? <EmptyState>Não há registros para este filtro.</EmptyState> : <div className="space-y-2">{filtered.map(item => <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border/50 p-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Activity size={15}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{item.action}</strong><span className="text-[11px] text-muted-foreground">{formatDate(item.timestamp)}</span></div><div className="mt-1 text-xs text-muted-foreground">{item.category}{item.network ? ' · ' + item.network : ''}</div>{item.details && <p className="mt-1 text-xs break-words">{item.details}</p>}{item.txHash && <p className="mt-1 break-all font-mono text-xs text-primary">{item.txHash}</p>}</div></div>)}</div>}
      </div>
      <p className="text-xs text-muted-foreground">Privacidade: os registros ficam no armazenamento local deste navegador/dispositivo; não são enviados automaticamente para um servidor e não sincronizam entre dispositivos.</p>
    </section>
  );
}

interface NVSettings { compact: boolean; reducedMotion: boolean; confirmations: boolean; }
const SETTINGS_KEY = 'nv_protocol_settings_v1';
const DEFAULT_SETTINGS: NVSettings = { compact: false, reducedMotion: false, confirmations: true };

export function SettingsModule() {
  const [settings, setSettings] = useState<NVSettings>(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return DEFAULT_SETTINGS; }
  });
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.dataset.nvCompact = settings.compact ? 'true' : 'false';
    document.documentElement.dataset.nvReducedMotion = settings.reducedMotion ? 'true' : 'false';
    const styleId = 'nv-user-preferences-style';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
    const compactCss = settings.compact ? 'html[data-nv-compact="true"] .p-5{padding:1rem!important}html[data-nv-compact="true"] .gap-5{gap:1rem!important}' : '';
    const motionCss = settings.reducedMotion ? '*,*::before,*::after{scroll-behavior:auto!important;animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important}' : '';
    style.textContent = compactCss + motionCss;
  }, [settings]);
  const update = (key: keyof NVSettings, value: boolean) => setSettings(previous => ({ ...previous, [key]: value }));
  const Toggle = ({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void }) => (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/60 p-4">
      <span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span>
      <input type="checkbox" checked={value} onChange={event => onChange(event.target.checked)} className="h-4 w-4 accent-primary"/>
    </label>
  );
  return (
    <section className="space-y-5">
      <div><div className="flex items-center gap-2 text-primary mb-2"><Settings2 size={18}/><span className="text-xs uppercase tracking-[0.2em] font-mono">NV Protocol</span></div><h1 className="text-2xl font-bold">Configurações</h1><p className={subtle + ' mt-1'}>Personalize alguns detalhes da sua experiência. As preferências ficam neste navegador.</p></div>
      <div className={panel + ' space-y-3'}>
        <h2 className={titleClass}>Preferências de interface</h2>
        <Toggle label="Interface compacta" description="Reduz alguns espaços para mostrar mais conteúdo na tela." value={settings.compact} onChange={value => update('compact', value)}/>
        <Toggle label="Reduzir animações" description="Diminui movimentos e transições da interface." value={settings.reducedMotion} onChange={value => update('reducedMotion', value)}/>
        <Toggle label="Mostrar lembretes de segurança" description="Exibe um lembrete de segurança nesta página de configurações." value={settings.confirmations} onChange={value => update('confirmations', value)}/>
      </div>
      {settings.confirmations && <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-muted-foreground">Nunca compartilhe sua frase-semente ou chave privada. Confira os detalhes de cada transação antes de aprovar na carteira.</div>}
      <div className={panel}>
        <div className="flex items-center gap-3"><div className="rounded-xl bg-amber-500/10 p-3 text-amber-400"><Sparkles size={20}/></div><div><h2 className={titleClass}>Mode Goat</h2><p className={subtle + ' mt-1'}>Um modo especial está sendo preparado.</p></div></div>
        <button disabled className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm font-semibold text-muted-foreground opacity-60" aria-label="Mode Goat em breve"><Sparkles size={16}/> MODE GOAT <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">EM BREVE</span></button>
      </div>
      <div className={panel + ' flex items-start gap-3'}><Palette size={18} className="mt-0.5 text-primary"/><div><h2 className="text-sm font-semibold">Configuração segura</h2><p className={subtle + ' mt-1'}>Estas opções alteram somente a experiência visual. Não mudam redes, permissões ou regras de transações.</p></div></div>
    </section>
  );
}

export function HelpModule() {
  const [expanded, setExpanded] = useState<number | null>(0);
  const steps = [
    { title: '1. Conheça o Dashboard', body: 'Acompanhe os indicadores de mercado, ativos, TVL e informações disponíveis no momento.' },
    { title: '2. Conecte sua carteira', body: 'Abra Carteira e conecte uma carteira compatível. Confira sempre a rede, o endereço e os dados exibidos.' },
    { title: '3. Use Swap e Bridge com atenção', body: 'Revise ativo, valor e rede de destino. Toda transação real deve ser conferida e aprovada na sua carteira. O suporte depende das redes e dos ativos disponíveis.' },
    { title: '4. Consulte NV Agent e NV News', body: 'Use o NV Agent para explorar as informações carregadas e abra as fontes originais do NV News para verificar o contexto.' },
    { title: '5. Consulte Histórico e Relatórios', body: 'Veja os hashes e eventos que este navegador conseguiu registrar. A atividade local pode não incluir operações feitas fora do app ou antes deste recurso.' },
  ];
  return (
    <section className="space-y-5">
      <div><div className="flex items-center gap-2 text-primary mb-2"><BookOpen size={18}/><span className="text-xs uppercase tracking-[0.2em] font-mono">NV Protocol</span></div><h1 className="text-2xl font-bold">Ajuda</h1><p className={subtle + ' mt-1'}>Um guia rápido para começar a usar o NV Protocol.</p></div>
      <div className={panel + ' space-y-2'}><h2 className={titleClass + ' mb-3'}>Mini-tutorial</h2>{steps.map((step, index) => <div key={step.title} className="rounded-xl border border-border/60"><button onClick={() => setExpanded(expanded === index ? null : index)} className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-medium">{step.title}<ChevronRight size={15} className={expanded === index ? 'rotate-90 text-primary transition-transform' : 'text-muted-foreground transition-transform'}/></button>{expanded === index && <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{step.body}</p>}</div>)}</div>
      <div className={panel}><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Mail size={20}/></div><div><h2 className={titleClass}>Fale conosco</h2><p className={subtle + ' mt-1'}>Dúvidas, problemas ou sugestões.</p></div></div><a href="mailto:nextvaultprotocol@gmail.com" className="mt-4 inline-flex items-center gap-2 break-all text-sm font-medium text-primary hover:underline">nextvaultprotocol@gmail.com <ExternalLink size={14}/></a></div>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-muted-foreground">Segurança: nunca compartilhe sua frase-semente ou chave privada. Confira a rede, os endereços e os detalhes antes de aprovar qualquer transação.</div>
    </section>
  );
}

export function logNVModuleView(view: string) {
  const categories: Record<string, NVActivity['category']> = {
    swap: 'swap', bridge: 'bridge', intelligence: 'agent', solana: 'wallet',
    carteira: 'wallet', dashboard: 'markets', historico: 'navigation',
    relatorios: 'navigation', configuracoes: 'navigation', ajuda: 'navigation',
  };
  const names: Record<string, string> = {
    swap: 'Módulo Swap aberto', bridge: 'Módulo Bridge aberto',
    intelligence: 'NV Agent / NV News aberto', solana: 'Módulo Solana aberto',
    carteira: 'Módulo Carteira aberto', dashboard: 'Dashboard / Global Markets aberto',
    historico: 'Histórico aberto', relatorios: 'Relatórios aberto',
    configuracoes: 'Configurações abertas', ajuda: 'Ajuda aberta',
  };
  logNVActivity({ category: categories[view] ?? 'navigation', action: names[view] ?? 'Módulo aberto', details: view });
}
