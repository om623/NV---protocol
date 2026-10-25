import { useMemo, useState } from 'react';
import { Award, Check, Coins, LockKeyhole, Package, Shield, ShoppingBag, Sparkles, Sword, WandSparkles, Zap } from 'lucide-react';

type Slot = 'Skin' | 'Capacete' | 'Armadura' | 'Arma';
type Rarity = 'Raro' | 'Épico' | 'Lendário';
type DemoItem = { id: string; name: string; slot: Slot; price: number; rarity: Rarity; accent: 'cyan' | 'violet' | 'sky' | 'amber'; description: string; icon: typeof Shield };

const ITEMS: DemoItem[] = [
  { id: 'skin-neon', name: 'Circuito Neon', slot: 'Skin', price: 120, rarity: 'Raro', accent: 'cyan', description: 'Linhas de energia sob a blindagem.', icon: Sparkles },
  { id: 'helmet-visor', name: 'Visor Spectra', slot: 'Capacete', price: 180, rarity: 'Épico', accent: 'violet', description: 'Visor espectral de leitura tática.', icon: Shield },
  { id: 'armor-pulse', name: 'Armadura Pulse', slot: 'Armadura', price: 260, rarity: 'Épico', accent: 'sky', description: 'Blindagem reativa com núcleo ampliado.', icon: Shield },
  { id: 'sword-plasma', name: 'Lâmina de Plasma', slot: 'Arma', price: 320, rarity: 'Lendário', accent: 'amber', description: 'Arma energética para futuras aventuras.', icon: Sword },
];

const TONE: Record<DemoItem['accent'], { border: string; text: string; bg: string; glow: string; hex: string }> = {
  cyan: { border: 'border-cyan-300/40', text: 'text-cyan-200', bg: 'bg-cyan-300/10', glow: 'shadow-[0_0_22px_rgba(34,211,238,.15)]', hex: '#67e8f9' },
  violet: { border: 'border-violet-300/40', text: 'text-violet-200', bg: 'bg-violet-300/10', glow: 'shadow-[0_0_22px_rgba(167,139,250,.15)]', hex: '#c4b5fd' },
  sky: { border: 'border-sky-300/40', text: 'text-sky-200', bg: 'bg-sky-300/10', glow: 'shadow-[0_0_22px_rgba(56,189,248,.15)]', hex: '#7dd3fc' },
  amber: { border: 'border-amber-300/40', text: 'text-amber-200', bg: 'bg-amber-300/10', glow: 'shadow-[0_0_22px_rgba(251,191,36,.15)]', hex: '#fcd34d' },
};

function NvultFigure({ equipped, level, equippedSkin }: { equipped: string[]; level: number; equippedSkin: string }) {
  const skin = equipped.includes('skin-neon');
  const armor = equipped.includes('armor-pulse');
  const helmet = equipped.includes('helmet-visor');
  const blade = equipped.includes('sword-plasma');
  const accent = armor ? '#7dd3fc' : skin ? '#67e8f9' : '#5eead4';
  return (
    <svg viewBox="0 0 360 390" role="img" aria-label="Nvult, personagem cibernético original com corpo mecânico aracnídeo" className="h-full w-full max-w-[340px] overflow-visible">
      <defs>
        <linearGradient id="nv-metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dbeafe"/><stop offset=".28" stopColor="#64748b"/><stop offset=".65" stopColor="#1e293b"/><stop offset="1" stopColor="#020617"/></linearGradient>
        <linearGradient id="nv-dark" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stopColor="#334155"/><stop offset=".5" stopColor="#111827"/><stop offset="1" stopColor="#020617"/></linearGradient>
        <linearGradient id="nv-core" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={accent} stopOpacity=".95"/><stop offset=".5" stopColor="#0e7490" stopOpacity=".45"/><stop offset="1" stopColor="#020617" stopOpacity=".95"/></linearGradient>
        <radialGradient id="nv-aura"><stop offset="0" stopColor={accent} stopOpacity=".32"/><stop offset="1" stopColor={accent} stopOpacity="0"/></radialGradient>
        <filter id="nv-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <ellipse cx="180" cy="190" rx="150" ry="165" fill="url(#nv-aura)" opacity=".6"/>
      <ellipse cx="180" cy="352" rx="98" ry="12" fill={accent} opacity=".12" filter="url(#nv-glow)"/>
      {/* Six articulated limbs grow directly out of the chassis; there is no floating companion or decorative ring. */}
      <g stroke="#64748b" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M137 215 L94 240 L58 286 L31 300"/><path d="M130 242 L90 272 L79 318 L54 335"/><path d="M145 267 L124 301 L132 337 L117 355"/>
        <path d="M223 215 L266 240 L302 286 L329 300"/><path d="M230 242 L270 272 L281 318 L306 335"/><path d="M215 267 L236 301 L228 337 L243 355"/>
      </g>
      <g stroke={accent} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".8">
        <path d="M137 215 L94 240 L58 286 L31 300"/><path d="M130 242 L90 272 L79 318 L54 335"/><path d="M145 267 L124 301 L132 337 L117 355"/>
        <path d="M223 215 L266 240 L302 286 L329 300"/><path d="M230 242 L270 272 L281 318 L306 335"/><path d="M215 267 L236 301 L228 337 L243 355"/>
      </g>
      <g fill="url(#nv-metal)" stroke="#94a3b8" strokeWidth="1.5">
        {[ [94,240],[58,286],[90,272],[79,318],[124,301],[132,337],[266,240],[302,286],[270,272],[281,318],[236,301],[228,337] ].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i%3===0?7:5}/>)}
      </g>
      {/* Rear chassis and shoulder plating */}
      <path d="M135 177 L109 190 L100 225 L121 250 L147 235 L151 199 Z" fill="url(#nv-metal)" stroke="#94a3b8" strokeWidth="1.5"/>
      <path d="M225 177 L251 190 L260 225 L239 250 L213 235 L209 199 Z" fill="url(#nv-metal)" stroke="#94a3b8" strokeWidth="1.5"/>
      {/* Torso: tapered armored core, with layered plates and exposed seams */}
      <path d="M139 166 Q180 150 221 166 L240 228 L218 287 Q180 310 142 287 L120 228 Z" fill="url(#nv-dark)" stroke={accent} strokeOpacity=".65" strokeWidth="2"/>
      <path d="M145 177 L180 190 L215 177 L224 224 L207 272 L180 284 L153 272 L136 224 Z" fill="url(#nv-metal)" stroke="#cbd5e1" strokeOpacity=".65" strokeWidth="1.5"/>
      <path d="M151 190 L180 201 L209 190 L203 218 L180 232 L157 218 Z" fill="#0f172a" stroke={accent} strokeOpacity=".8"/>
      <path d="M180 204 L193 218 L180 234 L167 218 Z" fill="url(#nv-core)" stroke={accent} strokeWidth="1.5" filter="url(#nv-glow)"/>
      <path d="M151 245 L169 255 L180 250 L191 255 L209 245" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"/>
      <path d="M157 267 L180 275 L203 267" fill="none" stroke="#94a3b8" strokeWidth="2"/>
      {/* Neck and head assembly */}
      <path d="M162 151 L164 166 L196 166 L198 151" fill="url(#nv-dark)" stroke="#94a3b8" strokeWidth="1.5"/>
      <path d="M143 78 L154 60 L206 60 L217 78 L224 125 L210 153 L180 165 L150 153 L136 125 Z" fill="url(#nv-metal)" stroke="#cbd5e1" strokeWidth="2"/>
      <path d="M149 87 L163 73 L197 73 L211 87 L208 111 L195 126 L165 126 L152 111 Z" fill="#020617" stroke="#64748b" strokeWidth="1.5"/>
      <path d="M157 96 L173 96 M187 96 L203 96" stroke={accent} strokeWidth="8" strokeLinecap="round" filter="url(#nv-glow)"/>
      <path d="M170 116 L180 120 L190 116" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M140 92 L129 101 L130 120 L140 126 M220 92 L231 101 L230 120 L220 126" fill="url(#nv-dark)" stroke="#94a3b8" strokeWidth="2"/>
      {helmet && <g><path d="M137 92 L140 67 L157 48 L203 48 L220 67 L223 92 L210 81 L150 81 Z" fill="#6d28d9" fillOpacity=".75" stroke="#c4b5fd" strokeWidth="2"/><path d="M151 69 L209 69" stroke="#ddd6fe" strokeWidth="3" filter="url(#nv-glow)"/></g>}
      {skin && <g stroke={accent} strokeWidth="2.2" fill="none" filter="url(#nv-glow)"><path d="M144 174 L131 225 L150 274"/><path d="M216 174 L229 225 L210 274"/><path d="M155 239 L180 248 L205 239"/></g>}
      {armor && <g><path d="M127 190 L145 177 L156 196 L143 229 L124 218 Z" fill="#38bdf8" fillOpacity=".4" stroke="#bae6fd" strokeWidth="1.5"/><path d="M233 190 L215 177 L204 196 L217 229 L236 218 Z" fill="#38bdf8" fillOpacity=".4" stroke="#bae6fd" strokeWidth="1.5"/></g>}
      {blade && <g filter="url(#nv-glow)"><path d="M257 213 L285 148 Q288 142 291 149 L273 224 Z" fill="#e0f2fe" stroke="#67e8f9" strokeWidth="2"/><path d="M251 221 L273 230" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round"/></g>}
      {/* Unique crest and level insignia */}
      <path d="M180 48 L187 36 L180 20 L173 36 Z" fill={accent} stroke="#cffafe" strokeWidth="1.5" filter="url(#nv-glow)"/>
      <text x="180" y="382" fill="#a5f3fc" fontSize="11" textAnchor="middle" letterSpacing="3" fontFamily="monospace">NV-{String(level).padStart(3,'0')}</text>
      <text x="180" y="22" fill="#94a3b8" fontSize="8" textAnchor="middle" letterSpacing="2" fontFamily="monospace">{equippedSkin.toUpperCase()}</text>
    </svg>
  );
}

export function NvultPrototype({ equippedSkin, level, xp }: { equippedSkin: string; level: number; xp: number }) {
  const [balance, setBalance] = useState(1000);
  const [owned, setOwned] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<string[]>([]);
  const [notice, setNotice] = useState('Laboratório de demonstração ativo. NvA e compras são fictícios.');
  const [filter, setFilter] = useState<'Todos' | Slot>('Todos');
  const activeItems = useMemo(() => ITEMS.filter(item => equipped.includes(item.id)), [equipped]);
  const visibleItems = ITEMS.filter(item => filter === 'Todos' || item.slot === filter);

  function buy(item: DemoItem) {
    if (owned.includes(item.id)) { setNotice('Este item já está no seu inventário.'); return; }
    if (balance < item.price) { setNotice('Saldo demonstrativo insuficiente para este item.'); return; }
    setBalance(value => value - item.price);
    setOwned(value => [...value, item.id]);
    setNotice(item.name + ' desbloqueado! Você já pode equipá-lo.');
  }
  function toggleEquip(item: DemoItem) {
    if (!owned.includes(item.id)) return;
    const isEquipped = equipped.includes(item.id);
    setEquipped(current => isEquipped ? current.filter(id => id !== item.id) : [...current.filter(id => ITEMS.find(other => other.id === id)?.slot !== item.slot), item.id]);
    setNotice(isEquipped ? item.name + ' removido.' : item.name + ' integrado ao Nvult.');
  }

  return (
    <section className="space-y-4" aria-label="Nvult e laboratório de personalização">
      <div className="relative isolate overflow-hidden rounded-[1.6rem] border border-cyan-300/20 bg-[#050b16] p-4 shadow-[0_18px_60px_rgba(0,0,0,.22)] sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: 'radial-gradient(ellipse at 50% 40%, rgba(8,145,178,.16), transparent 52%), radial-gradient(ellipse at 90% 0%, rgba(124,58,237,.10), transparent 40%), linear-gradient(rgba(148,163,184,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.04) 1px, transparent 1px)', backgroundSize: 'auto, auto, 28px 28px, 28px 28px' }} />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[9px] font-mono uppercase tracking-[.28em] text-cyan-200/70"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_9px_#67e8f9]" /> NV PROTOCOL <span className="text-slate-600">/</span> SEASON 0</div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Nvult <span className="text-cyan-300">Protocol Guardian</span></h2>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-slate-400">Uma identidade cibernética própria. Cada peça se conecta ao corpo do Nvult — sem mascote separado, moldura ou objeto orbitando o personagem.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[.07] px-3 py-2">
            <Coins size={17} className="text-amber-200" /><div><div className="text-[9px] uppercase tracking-wider text-amber-100/55">Moeda de teste</div><div className="font-mono text-lg font-bold text-amber-100">{balance.toLocaleString('pt-BR')} NvA</div></div>
          </div>
        </div>
        <div className="relative mt-5 grid gap-4 lg:grid-cols-[1.02fr_.98fr]">
          <div className="relative flex min-h-[390px] flex-col items-center justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0a1728] via-[#07111f] to-[#030711] px-3 py-4 sm:px-5">
            <div className="absolute left-3 top-3 text-[8px] font-mono tracking-[.22em] text-slate-600">NV-UNIT / PERSONAL CLASS</div>
            <div className="absolute right-3 top-3 flex items-center gap-1 text-[8px] font-mono text-emerald-300/70"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> ONLINE</div>
            <div className="relative mt-5 flex h-[300px] w-full items-center justify-center">
              <div className="absolute inset-x-4 bottom-0 top-0 rounded-[45%] bg-cyan-300/[.025] blur-2xl" />
              <NvultFigure equipped={equipped} level={level} equippedSkin={equippedSkin} />
            </div>
            <div className="relative z-10 -mt-1 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2"><span className="text-lg font-semibold text-white">Nvult</span><span className="rounded-md border border-cyan-300/25 bg-cyan-300/[.07] px-2 py-1 text-[9px] font-mono text-cyan-200">LVL {level}</span></div>
              <div className="mt-1 text-[9px] font-mono uppercase tracking-[.18em] text-slate-500">Núcleo cibernético · {equippedSkin}</div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">{activeItems.length ? activeItems.map(item => <span key={item.id} className={'rounded-full border px-2 py-1 text-[9px] ' + TONE[item.accent].border + ' ' + TONE[item.accent].text + ' ' + TONE[item.accent].bg}>{item.name}</span>) : <span className="text-[10px] text-slate-500">Seu equipamento aparecerá no corpo do personagem</span>}</div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[.025] p-3"><div className="text-[9px] uppercase tracking-wider text-slate-500">Nível atual</div><div className="mt-1 text-2xl font-bold text-white">{level}</div><div className="mt-1 text-[9px] text-slate-600">Progressão do Perfil</div></div>
              <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.035] p-3"><div className="text-[9px] uppercase tracking-wider text-slate-500">XP acumulado</div><div className="mt-1 text-2xl font-bold text-cyan-200">{xp.toLocaleString('pt-BR')}</div><div className="mt-1 text-[9px] text-slate-600">Experiência total</div></div>
            </div>
            <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[.035] p-3">
              <div className="mb-2 flex items-center justify-between text-[10px]"><span className="text-slate-300">Progresso demonstrativo</span><span className="font-mono text-cyan-200">{Math.min(100, Math.round((xp % 100) || 0))}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400" style={{ width: Math.min(100, (xp % 100) || 0) + '%' }} /></div>
              <p className="mt-2 text-[9px] text-slate-500">O sistema sazonal real será integrado após a aprovação visual.</p>
            </div>
            <div className="rounded-xl border border-violet-300/15 bg-violet-300/[.035] p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-violet-100"><Package size={13} /> Inventário <span className="ml-auto font-mono text-violet-200">{owned.length}/{ITEMS.length}</span></div>
              {owned.length ? <div className="flex flex-wrap gap-1.5">{owned.map(id => { const item = ITEMS.find(entry => entry.id === id)!; return <span key={id} className="rounded-md border border-white/10 bg-white/[.035] px-2 py-1 text-[9px] text-slate-300">{item.name}</span>; })}</div> : <p className="text-[10px] text-slate-500">Desbloqueie equipamentos para montar seu loadout.</p>}
            </div>
            <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.035] p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-100"><LockKeyhole size={13} /> Ambiente seguro de teste</div>
              <p className="text-[10px] leading-relaxed text-slate-400">Saldo NvA e compras são fictícios. Não há conexão com carteira, blockchain ou pagamento real nesta fase.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.4rem] border border-white/10 bg-gradient-to-br from-[#0b1423] to-[#070b14] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><div className="mb-1 flex items-center gap-2 text-[9px] font-mono uppercase tracking-[.22em] text-amber-200/60"><Zap size={11} /> Armory / 01</div><h3 className="flex items-center gap-2 text-base font-semibold text-white"><ShoppingBag size={16} className="text-amber-200" /> Arsenal de personalização</h3><p className="mt-1 text-[10px] text-slate-500">Peças cosméticas de teste. Os valores não são preços finais.</p></div>
          <div className="flex flex-wrap gap-1">{(['Todos', 'Skin', 'Capacete', 'Armadura', 'Arma'] as const).map(value => <button key={value} onClick={() => setFilter(value)} className={'rounded-lg border px-2.5 py-1.5 text-[10px] transition-colors ' + (filter === value ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-slate-500 hover:text-white')}>{value}</button>)}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleItems.map(item => {
            const Icon = item.icon; const tone = TONE[item.accent]; const isOwned = owned.includes(item.id); const isEquipped = equipped.includes(item.id);
            return <article key={item.id} className={'group relative overflow-hidden rounded-xl border p-3 transition-all ' + (isOwned ? 'border-emerald-300/20 bg-emerald-300/[.025]' : 'border-white/10 bg-white/[.02] hover:border-white/20')}>
              <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, ' + tone.hex + ', transparent)' }} />
              <div className="flex items-start gap-3">
                <div className={'relative flex h-[76px] w-[66px] shrink-0 items-center justify-center overflow-hidden rounded-lg border ' + tone.border + ' ' + tone.bg + ' ' + tone.glow}>
                  <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)', backgroundSize: '12px 12px' }} />
                  <Icon size={25} className={'relative ' + tone.text} />
                  <span className="absolute bottom-1 right-1 text-[7px] font-mono opacity-50">NV</span>
                </div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h4 className="text-xs font-semibold text-white">{item.name}</h4>{isOwned && <Check size={12} className="shrink-0 text-emerald-300" />}</div><div className={'mt-1 text-[8px] font-mono uppercase tracking-[.14em] ' + tone.text}>{item.rarity} · {item.slot}</div><p className="mt-2 text-[10px] leading-relaxed text-slate-500">{item.description}</p><div className="mt-2 font-mono text-xs font-semibold text-amber-100">{item.price} NvA <span className="text-[9px] font-normal text-slate-600">· simulação</span></div></div>
              </div>
              <div className="mt-3 flex gap-2">{!isOwned ? <button onClick={() => buy(item)} className="flex-1 rounded-lg border border-amber-200/20 bg-amber-200/[.07] px-3 py-2 text-[10px] font-semibold text-amber-100 transition-colors hover:bg-amber-200/[.12]">Desbloquear</button> : <button onClick={() => toggleEquip(item)} className={'flex-1 rounded-lg border px-3 py-2 text-[10px] font-semibold transition-colors ' + (isEquipped ? 'border-cyan-200/25 bg-cyan-200/10 text-cyan-100' : 'border-white/10 bg-white/[.03] text-slate-300 hover:border-cyan-200/20')}>{isEquipped ? 'Remover equipamento' : 'Equipar no Nvult'}</button>}</div>
            </article>;
          })}
        </div>
        <div role="status" aria-live="polite" className="mt-4 flex items-start gap-2 rounded-lg border border-cyan-300/15 bg-cyan-300/[.035] p-3 text-[10px] leading-relaxed text-cyan-100/80"><WandSparkles size={13} className="mt-0.5 shrink-0" />{notice}</div>
      </div>
      <p className="text-center text-[9px] font-mono tracking-[.12em] text-slate-600">PROTÓTIPO VISUAL · NvA SEM VALOR REAL · SEM TRANSAÇÕES ON-CHAIN</p>
    </section>
  );
}
