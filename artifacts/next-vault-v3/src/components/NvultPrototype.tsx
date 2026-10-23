import { useMemo, useState } from 'react';
import { Bot, Check, Coins, LockKeyhole, Package, Shield, ShoppingBag, Sparkles, Sword, WandSparkles } from 'lucide-react';

type DemoItem = {
  id: string;
  name: string;
  slot: 'Skin' | 'Capacete' | 'Armadura' | 'Arma';
  price: number;
  rarity: 'Comum' | 'Raro' | 'Épico' | 'Lendário';
  accent: string;
  icon: typeof Shield;
};

const ITEMS: DemoItem[] = [
  { id: 'skin-neon', name: 'Circuito Neon', slot: 'Skin', price: 120, rarity: 'Raro', accent: 'cyan', icon: Sparkles },
  { id: 'helmet-visor', name: 'Visor Spectra', slot: 'Capacete', price: 180, rarity: 'Épico', accent: 'violet', icon: Shield },
  { id: 'armor-pulse', name: 'Armadura Pulse', slot: 'Armadura', price: 260, rarity: 'Épico', accent: 'sky', icon: Shield },
  { id: 'sword-plasma', name: 'Lâmina de Plasma', slot: 'Arma', price: 320, rarity: 'Lendário', accent: 'amber', icon: Sword },
];

const ACCENTS: Record<string, string> = {
  cyan: 'border-cyan-400/40 text-cyan-300 bg-cyan-400/10',
  violet: 'border-violet-400/40 text-violet-300 bg-violet-400/10',
  sky: 'border-sky-400/40 text-sky-300 bg-sky-400/10',
  amber: 'border-amber-400/40 text-amber-300 bg-amber-400/10',
};

export function NvultPrototype({ equippedSkin, level, xp }: { equippedSkin: string; level: number; xp: number }) {
  const [balance, setBalance] = useState(1000);
  const [owned, setOwned] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<string[]>([]);
  const [notice, setNotice] = useState('Bem-vindo ao laboratório do Nvult. Todas as compras são simuladas.');
  const [filter, setFilter] = useState<'Todos' | DemoItem['slot']>('Todos');

  const activeItems = useMemo(() => ITEMS.filter(item => equipped.includes(item.id)), [equipped]);
  const visibleItems = ITEMS.filter(item => filter === 'Todos' || item.slot === filter);

  function buy(item: DemoItem) {
    if (owned.includes(item.id)) {
      setNotice('Este item já está no seu inventário.');
      return;
    }
    if (balance < item.price) {
      setNotice('Saldo de demonstração insuficiente para este item.');
      return;
    }
    setBalance(value => value - item.price);
    setOwned(value => [...value, item.id]);
    setNotice(item.name + ' desbloqueado no inventário de demonstração!');
  }

  function toggleEquip(item: DemoItem) {
    if (!owned.includes(item.id)) return;
    setEquipped(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current.filter(id => ITEMS.find(other => other.id === id)?.slot !== item.slot), item.id]);
    setNotice(equipped.includes(item.id) ? item.name + ' removido.' : item.name + ' equipado no Nvult!');
  }

  return (
    <section className="space-y-4" aria-label="Protótipo Nvult">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#07111d] p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 50% 35%, rgba(34,211,238,.18), transparent 45%), linear-gradient(rgba(56,189,248,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.05) 1px, transparent 1px)', backgroundSize: 'auto, 24px 24px, 24px 24px' }} />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[.24em] text-cyan-300/70"><Sparkles size={12} /> NV PROTOCOL · SEASON 0</div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Conheça <span className="text-cyan-300">Nvult</span></h2>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-slate-400">Seu guardião digital. Evolua, colecione equipamentos e personalize sua identidade no ecossistema NV.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2">
            <Coins size={17} className="text-amber-300" />
            <div><div className="text-[9px] uppercase tracking-wider text-amber-200/60">Saldo de teste</div><div className="font-mono text-lg font-bold text-amber-200">{balance.toLocaleString('pt-BR')} NvA</div></div>
          </div>
        </div>

        <div className="relative mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-cyan-300/15 bg-slate-950/60 p-4">
            <div className="mb-3 flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-[9px] font-mono uppercase tracking-widest text-cyan-200/70"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" /> Nvult online</div>
            <div className="relative flex h-48 w-40 items-center justify-center">
              <div className="absolute bottom-2 h-7 w-32 rounded-full bg-cyan-400/10 blur-xl" />
              {/* The spider-like silhouette is part of Nvult's own body, not a separate companion. */}
              <div className="absolute bottom-12 left-[2.1rem] h-16 w-7 -rotate-[42deg] origin-top rounded-full border border-cyan-300/45 bg-gradient-to-b from-slate-400/90 to-slate-900 shadow-[0_0_10px_rgba(34,211,238,.12)]" />
              <div className="absolute bottom-[4.8rem] left-[1.65rem] h-14 w-6 rotate-[28deg] origin-top rounded-full border border-slate-500/80 bg-gradient-to-b from-slate-400 to-slate-900" />
              <div className="absolute bottom-12 right-[2.1rem] h-16 w-7 rotate-[42deg] origin-top rounded-full border border-cyan-300/45 bg-gradient-to-b from-slate-400/90 to-slate-900 shadow-[0_0_10px_rgba(34,211,238,.12)]" />
              <div className="absolute bottom-[4.8rem] right-[1.65rem] h-14 w-6 -rotate-[28deg] origin-top rounded-full border border-slate-500/80 bg-gradient-to-b from-slate-400 to-slate-900" />
              <div className={'absolute bottom-12 h-24 w-24 rounded-[28px] border bg-gradient-to-br from-slate-500 via-slate-800 to-slate-950 shadow-[0_0_35px_rgba(34,211,238,.12)] ' + (equipped.includes('armor-pulse') ? 'border-sky-300 shadow-[0_0_24px_rgba(56,189,248,.28)]' : 'border-slate-500/80')} >
                <div className="absolute inset-x-4 top-5 h-1 rounded-full bg-cyan-300/80 shadow-[0_0_10px_rgba(103,232,249,.9)]" />
                <div className="absolute inset-x-5 bottom-5 h-1 rounded-full bg-cyan-300/45" />
              </div>
              <div className="absolute bottom-[7.7rem] h-[4.7rem] w-[4.8rem] rounded-[22px] border border-slate-400/80 bg-gradient-to-br from-slate-300 via-slate-700 to-slate-950 shadow-lg">
                <div className="absolute left-2 right-2 top-5 flex h-4 items-center justify-center gap-2 rounded-md border border-cyan-200/30 bg-slate-950">
                  <span className="h-1.5 w-3 rounded-full bg-cyan-300 shadow-[0_0_10px_#67e8f9]" /><span className="h-1.5 w-3 rounded-full bg-cyan-300 shadow-[0_0_10px_#67e8f9]" />
                </div>
                <div className="absolute -left-2 top-5 h-5 w-2 rounded border border-slate-400 bg-slate-700" /><div className="absolute -right-2 top-5 h-5 w-2 rounded border border-slate-400 bg-slate-700" />
                {equipped.includes('helmet-visor') && <div className="absolute -top-2 left-1/2 h-3 w-14 -translate-x-1/2 rounded-t-lg border border-violet-300 bg-violet-300/30 shadow-[0_0_14px_rgba(167,139,250,.6)]" />}
              </div>
              {equipped.includes('sword-plasma') && <div className="absolute bottom-[5.4rem] right-0 h-24 w-2 rotate-[-24deg] rounded-full bg-gradient-to-t from-cyan-200 via-blue-300 to-white shadow-[0_0_12px_rgba(103,232,249,.9)]" />}
              {equipped.includes('skin-neon') && <div className="absolute bottom-14 h-20 w-20 rounded-[24px] border border-cyan-300/70 shadow-[0_0_20px_rgba(34,211,238,.35)]" />}
            </div>
            <div className="text-center"><div className="text-lg font-semibold text-white">Nvult <span className="text-xs font-mono text-cyan-300">#{String(level).padStart(3, '0')}</span></div><div className="mt-1 text-[10px] font-mono text-slate-500">SKIN ATUAL: {equippedSkin.toUpperCase()}</div></div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">{activeItems.length ? activeItems.map(item => <span key={item.id} className={'rounded-full border px-2 py-1 text-[9px] ' + ACCENTS[item.accent]}>{item.name}</span>) : <span className="text-[10px] text-slate-500">Equipe itens para transformar seu Nvult</span>}</div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><div className="text-[9px] uppercase tracking-wider text-slate-500">Nível</div><div className="mt-1 text-xl font-bold text-white">{level}</div></div>
              <div className="rounded-xl border border-white/10 bg-white/[.03] p-3"><div className="text-[9px] uppercase tracking-wider text-slate-500">XP acumulado</div><div className="mt-1 text-xl font-bold text-cyan-200">{xp.toLocaleString('pt-BR')}</div></div>
            </div>
            <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.04] p-3">
              <div className="mb-2 flex items-center justify-between text-[10px]"><span className="text-slate-300">Progresso da Temporada 0</span><span className="font-mono text-cyan-200">{Math.min(100, Math.round((xp % 100) || 0))}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400" style={{ width: Math.min(100, (xp % 100) || 0) + '%' }} /></div>
              <p className="mt-2 text-[9px] text-slate-500">Interface de demonstração. Progresso sazonal real será conectado depois.</p>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-200"><LockKeyhole size={13} /> Economia de teste</div>
              <p className="text-[10px] leading-relaxed text-slate-400">O saldo NvA é fictício e existe apenas nesta demonstração. Nenhuma carteira, blockchain ou pagamento real é acessado.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-200"><Package size={13} /> Inventário <span className="ml-auto font-mono text-cyan-200">{owned.length}/{ITEMS.length}</span></div>
              <p className="text-[10px] text-slate-500">{owned.length ? owned.map(id => ITEMS.find(item => item.id === id)?.name).filter(Boolean).join(' · ') : 'Seus itens desbloqueados aparecerão aqui.'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><ShoppingBag size={15} className="text-amber-400" /> Laboratório de equipamentos</h3><p className="mt-1 text-[10px] text-muted-foreground/50">Valores temporários para testar a experiência — não são preços finais.</p></div><div className="flex flex-wrap gap-1">{(['Todos', 'Skin', 'Capacete', 'Armadura', 'Arma'] as const).map(value => <button key={value} onClick={() => setFilter(value)} className={'rounded-lg border px-2 py-1 text-[10px] transition-colors ' + (filter === value ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/30 text-muted-foreground hover:text-foreground')}>{value}</button>)}</div></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isOwned = owned.includes(item.id);
            const isEquipped = equipped.includes(item.id);
            return <article key={item.id} className={'rounded-xl border p-3 transition-colors ' + (isOwned ? 'border-emerald-400/20 bg-emerald-400/[.03]' : 'border-border/30 bg-secondary/20')}>
              <div className="flex items-start gap-3"><div className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ' + ACCENTS[item.accent]}><Icon size={17} /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h4 className="truncate text-xs font-semibold text-foreground">{item.name}</h4>{isOwned && <Check size={12} className="shrink-0 text-emerald-400" />}</div><div className="mt-1 text-[9px] text-muted-foreground">{item.slot} · {item.rarity}</div><div className="mt-2 font-mono text-xs font-semibold text-amber-300">{item.price} NvA <span className="font-normal text-muted-foreground/60">· teste</span></div></div></div>
              <div className="mt-3 flex gap-2">{!isOwned ? <button onClick={() => buy(item)} className="flex-1 rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[10px] font-semibold text-amber-200 transition-colors hover:bg-amber-300/15">Desbloquear</button> : <button onClick={() => toggleEquip(item)} className={'flex-1 rounded-lg border px-3 py-2 text-[10px] font-semibold transition-colors ' + (isEquipped ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200' : 'border-border/30 bg-secondary/40 text-foreground hover:border-primary/30')}>{isEquipped ? 'Remover equipamento' : 'Equipar no Nvult'}</button>}</div>
            </article>;
          })}
        </div>
        <div role="status" aria-live="polite" className="mt-3 flex items-start gap-2 rounded-lg border border-cyan-300/15 bg-cyan-300/[.04] p-3 text-[10px] leading-relaxed text-cyan-100/80"><WandSparkles size={13} className="mt-0.5 shrink-0" />{notice}</div>
      </div>
      <p className="text-center text-[9px] text-muted-foreground/40">PROTÓTIPO EXPERIMENTAL · NvA E ITENS SEM VALOR REAL · NÃO CONECTADO A PAGAMENTOS</p>
    </section>
  );
}
