import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Check, ChevronRight, CircleHelp, Copy, ExternalLink, Eye, FileText, Globe, Mail, Palette, ShieldCheck, Sparkles, Wallet, Zap } from 'lucide-react';

export type NVActivity = {
  id: string;
  at: string;
  category: string;
  action: string;
  details?: string;
  txHash?: string;
  walletAddress?: string;
  status?: 'success' | 'info' | 'warning' | 'error';
};

const STORAGE_KEY = 'nv-protocol-activity-v1';
const SETTINGS_KEY = 'nv-protocol-preferences-v1';

export function recordNVActivity(entry: Omit<NVActivity, 'id' | 'at'>) {
  if (typeof window === 'undefined') return;
  try {
    const existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as NVActivity[];
    const item: NVActivity = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...existing].slice(0, 1000)));
    window.dispatchEvent(new CustomEvent('nv:activity', { detail: item }));
  } catch (error) {
    console.warn('NV activity could not be stored locally', error);
  }
}

function readActivity(): NVActivity[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function Panel({ icon: Icon, eyebrow, title, children }: { icon: React.ElementType; eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border/50 bg-card/70 p-5 sm:p-6 shadow-sm">
    <div className="mb-5 flex items-start gap-3">
      <div className="rounded-xl border border-primary/20 bg-primary/10 p-2.5 text-primary"><Icon size={19} /></div>
      <div><div className="text-[10px] font-mono uppercase tracking-[.22em] text-primary/70">{eyebrow}</div><h2 className="mt-1 text-xl font-semibold text-foreground">{title}</h2></div>
    </div>
    {children}
  </section>;
}

export function NVHistoryView({ walletAddress }: { walletAddress: string | null }) {
  const [items, setItems] = useState<NVActivity[]>([]);
  useEffect(() => {
    const refresh = () => setItems(readActivity());
    refresh();
    window.addEventListener('nv:activity', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('nv:activity', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const relevant = items.filter(x => x.txHash || x.category.toLowerCase().includes('wallet') || x.walletAddress);
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); } catch {} };
  return <Panel icon={Wallet} eyebrow="NV Protocol · Registro" title="Histórico">
    <p className="mb-4 text-sm text-muted-foreground">Identificação da carteira conectada e hashes de transações registrados pelo NV Protocol neste dispositivo.</p>
    <div className="mb-5 rounded-xl border border-border/50 bg-secondary/20 p-4">
      <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Hash / endereço da carteira</div>
      {walletAddress ? <div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs text-foreground">{walletAddress}</code><button onClick={() => copy(walletAddress)} aria-label="Copiar endereço" className="rounded-lg p-2 hover:bg-secondary"><Copy size={15}/></button></div> : <div className="text-sm text-muted-foreground">Conecte sua carteira para exibir seu endereço.</div>}
    </div>
    <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Hashes e registros recentes</h3><span className="text-xs text-muted-foreground">{relevant.length} registros</span></div>
    {relevant.length ? <div className="space-y-2">{relevant.map(item => <div key={item.id} className="rounded-xl border border-border/40 bg-background/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{item.action}</span><time className="text-[10px] text-muted-foreground">{new Date(item.at).toLocaleString()}</time></div>
      {item.txHash && <div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs text-primary">{item.txHash}</code><button onClick={() => copy(item.txHash!)} aria-label="Copiar hash" className="rounded-lg p-1.5 hover:bg-secondary"><Copy size={14}/></button></div>}
      {item.details && <p className="mt-1 break-words text-xs text-muted-foreground">{item.details}</p>}
    </div>)}</div> : <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Ainda não há hashes de transação registrados. Novos registros aparecerão aqui quando ações instrumentadas forem executadas.</div>}
    <p className="mt-4 text-[11px] text-muted-foreground">Os registros são locais neste navegador; não são um indexador on-chain nem um arquivo sincronizado entre dispositivos.</p>
  </Panel>;
}

export function NVReportsView() {
  const [items, setItems] = useState<NVActivity[]>([]);
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    const refresh = () => setItems(readActivity());
    refresh();
    window.addEventListener('nv:activity', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('nv:activity', refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const categories = useMemo(() => [...new Set(items.map(x => x.category))], [items]);
  const shown = filter === 'all' ? items : items.filter(x => x.category === filter);
  const download = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'nv-protocol-report.json'; a.click(); URL.revokeObjectURL(url);
  };
  return <Panel icon={FileText} eyebrow="NV Protocol · Auditoria local" title="Relatório">
    <p className="mb-4 text-sm text-muted-foreground">Registro cronológico das ações instrumentadas: carteira, swap, bridge, NV Agent, notícias e interação com mercados. O relatório não inventa eventos; só lista atividades realmente registradas.</p>
    <div className="mb-4 flex flex-wrap items-center gap-2"><select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2 text-sm"><option value="all">Todas as categorias</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select><button onClick={download} disabled={!items.length} className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary disabled:opacity-40"><FileText size={14}/> Exportar JSON</button><span className="ml-auto text-xs text-muted-foreground">{shown.length} eventos</span></div>
    {shown.length ? <div className="space-y-2">{shown.map(item => <div key={item.id} className="flex gap-3 rounded-xl border border-border/40 bg-background/40 p-3"><div className="mt-0.5 rounded-lg bg-secondary/60 p-2 text-muted-foreground"><Activity size={14}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] uppercase tracking-wider text-primary">{item.category}</span><span className="text-sm font-medium">{item.action}</span></div>{item.details && <p className="mt-1 break-words text-xs text-muted-foreground">{item.details}</p>}{item.txHash && <code className="mt-1 block break-all text-[10px] text-primary">{item.txHash}</code>}<time className="mt-2 block text-[10px] text-muted-foreground">{new Date(item.at).toLocaleString()}</time></div></div>)}</div> : <div className="rounded-xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">Nenhuma atividade registrada ainda. Conforme você usa os módulos, os eventos registrados aparecem aqui.</div>}
    <p className="mt-4 text-[11px] text-muted-foreground">Privacidade: os dados ficam no armazenamento local deste navegador. Para auditoria completa e compartilhada, será necessário um serviço persistente no backend.</p>
  </Panel>;
}

type Preferences = { accent: 'mint' | 'blue' | 'violet'; compact: boolean; motion: boolean; confirmActions: boolean };
const DEFAULT_PREFS: Preferences = { accent: 'mint', compact: false, motion: true, confirmActions: true };

export function NVSettingsView() {
  const [prefs, setPrefs] = useState<Preferences>(() => {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return DEFAULT_PREFS; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs)); } catch {}
    const root = document.documentElement;
    root.style.setProperty('--primary', prefs.accent === 'blue' ? '213 94% 58%' : prefs.accent === 'violet' ? '263 83% 65%' : '166 100% 45%');
    root.dataset.nvDensity = prefs.compact ? 'compact' : 'comfortable';
    root.dataset.nvMotion = prefs.motion ? 'on' : 'off';
  }, [prefs]);
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPrefs(old => ({ ...old, [key]: value }));
  const toggle = (key: 'compact' | 'motion' | 'confirmActions', label: string, description: string) => <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/40 bg-background/40 p-4"><span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span><input type="checkbox" checked={prefs[key]} onChange={e => update(key, e.target.checked)} className="h-4 w-4 accent-primary"/></label>;
  return <Panel icon={Palette} eyebrow="NV Protocol · Personalização" title="Configurações">
    <p className="mb-5 text-sm text-muted-foreground">Personalize a aparência e o comportamento da interface. Suas preferências ficam salvas neste navegador.</p>
    <div className="space-y-3">
      <div className="rounded-xl border border-border/40 bg-background/40 p-4"><div className="mb-3 text-sm font-medium">Cor de destaque</div><div className="flex flex-wrap gap-2">{([{id:'mint',label:'NV Mint',color:'#00e5bc'},{id:'blue',label:'Azul',color:'#3b82f6'},{id:'violet',label:'Violeta',color:'#8b5cf6'}] as const).map(c => <button key={c.id} onClick={() => update('accent',c.id)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${prefs.accent===c.id?'border-primary bg-primary/10':'border-border hover:bg-secondary'}`}><span className="h-3 w-3 rounded-full" style={{background:c.color}}/>{c.label}{prefs.accent===c.id&&<Check size={13}/>}</button>)}</div></div>
      {toggle('compact','Interface compacta','Reduz espaços para mostrar mais informação na tela.')}
      {toggle('motion','Animações da interface','Permite desligar animações decorativas.')}
      {toggle('confirmActions','Confirmação visual de ações','Mantém avisos visuais nas ações importantes.')}
      <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"><div className="flex items-center gap-2"><Sparkles size={17} className="text-amber-400"/><div><div className="text-sm font-semibold">Mode GOAT</div><div className="text-xs text-muted-foreground">Em breve · modo avançado de personalização e experiência</div></div></div><button disabled title="Disponível em breve" className="mt-4 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm font-semibold text-muted-foreground opacity-50"><Zap size={15}/> Ativar Mode GOAT <span className="text-[10px] uppercase tracking-widest">Em breve</span></button></div>
      <button onClick={() => setPrefs(DEFAULT_PREFS)} className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary">Restaurar padrão</button>
    </div>
  </Panel>;
}

export function NVHelpView() {
  const steps = [
    ['1. Conecte sua carteira','Use o botão de conexão para autorizar uma carteira compatível. Nunca compartilhe sua frase-semente ou chave privada.'],
    ['2. Explore o Dashboard','Veja os mercados, indicadores e informações disponíveis. Os valores dependem das fontes de dados conectadas.'],
    ['3. Swap e Bridge','Abra o módulo Swap para consultar o fluxo disponível. A bridge transfere ativos entre redes compatíveis; confira rede, token, taxas e endereço antes de confirmar.'],
    ['4. NV Agent e NV News','Faça perguntas ao agente e consulte notícias. Confira links e fontes antes de agir: respostas de IA podem conter erros.'],
    ['5. Histórico e Relatório','O Histórico mostra o endereço da carteira e hashes registrados. O Relatório reúne as atividades instrumentadas neste navegador e permite exportá-las em JSON.'],
    ['6. Segurança','O NV Protocol não pede sua frase-semente. Transações blockchain podem ser irreversíveis. Confirme sempre a rede e os detalhes na carteira.'],
  ];
  return <Panel icon={CircleHelp} eyebrow="NV Protocol · Central de ajuda" title="Ajuda">
    <p className="mb-5 text-sm text-muted-foreground">Um guia rápido para começar a usar o NV Protocol.</p>
    <div className="space-y-3">{steps.map(([title,body]) => <div key={title} className="rounded-xl border border-border/40 bg-background/40 p-4"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p></div>)}</div>
    <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Mail size={16} className="text-primary"/> Fale com o desenvolvedor</div><p className="mt-1 text-sm text-muted-foreground">Dúvidas, sugestões ou problemas com o NV Protocol.</p><a href="mailto:nextvaultprotocol@gmail.com" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Mail size={15}/> nextvaultprotocol@gmail.com <ExternalLink size={13}/></a></div>
  </Panel>;
}
