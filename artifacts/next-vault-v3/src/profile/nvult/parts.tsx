// ── Nvult parts v2: richer SVG renderers, all drawn in the same 360x400 space ─
import type { ReactNode } from 'react';

export type RefName = 'metal' | 'metalV' | 'dark' | 'core' | 'glow' | 'bloom' | 'bevel' | 'wing' | 'nebula' | 'blade' | 'glass';

export interface PartCtx {
  accent: string;
  /** Builds a url(#...) reference to a gradient/filter defined by NvultFigure. */
  ref: (name: RefName) => string;
  still: boolean;
  /** Thumbnails skip the expensive relief filter. */
  lite: boolean;
}

const bevel = (c: PartCtx) => (c.lite ? undefined : c.ref('bevel'));
const anim = (c: PartCtx, cls: string) => (c.still ? undefined : cls);

/** Draws its children as authored (left side, x < 180) and mirrored on the right. */
export function Sym({ children }: { children: ReactNode }) {
  return <>{children}<g transform="translate(360 0) scale(-1 1)">{children}</g></>;
}

/** A glowing energy conduit whose pulses flow along the path. */
function Flow({ d, c, w = 1.8, op = 0.95 }: { d: string; c: PartCtx; w?: number; op?: number }) {
  return <path d={d} fill="none" stroke={c.accent} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity={op} strokeDasharray="5 7" className={anim(c, 'nvf-flow')} filter={c.ref('glow')} />;
}

// ── Head overlays (the faceted base head is always drawn) ────────────────────
export function Head({ id, c }: { id: string; c: PartCtx }): ReactNode {
  const a = c.accent;
  switch (id) {
    case 'crest':
      return (
        <g>
          <path d="M166 60 L194 60 L188 49 L172 49 Z" fill={c.ref('metalV')} stroke="#94a3b8" strokeWidth="1.2" />
          <path d="M180 52 L189 36 L180 12 L171 36 Z" fill={a} stroke="#ecfeff" strokeWidth="1.4" filter={c.ref('glow')} className={anim(c, 'nvf-pulse')} />
          <path d="M180 50 L180 16" stroke="#fff" strokeOpacity=".6" strokeWidth=".9" />
          <path d="M165 55 L158 40 L169 50 Z M195 55 L202 40 L191 50 Z" fill={a} fillOpacity=".75" stroke="#ecfeff" strokeWidth=".8" />
        </g>
      );
    case 'dome':
      return (
        <g>
          <path d="M145 84 Q146 40 180 36 Q214 40 215 84 L207 77 Q180 58 153 77 Z" fill={c.ref('metalV')} stroke="#e2e8f0" strokeWidth="1.8" filter={bevel(c)} />
          <path d="M159 57 Q180 46 201 57" fill="none" stroke={a} strokeWidth="2.4" strokeLinecap="round" filter={c.ref('glow')} />
          <path d="M172 44 L180 36 L188 44 L180 53 Z" fill={a} stroke="#fff" strokeWidth=".8" filter={c.ref('glow')} className={anim(c, 'nvf-pulse')} />
          <path d="M150 72 L156 64 M210 72 L204 64 M146 80 L152 73 M214 80 L208 73" stroke="#64748b" strokeWidth="1.2" />
        </g>
      );
    case 'spectra':
      return (
        <g>
          <path d="M136 94 L138 66 L156 45 L204 45 L222 66 L224 94 L210 83 L150 83 Z" fill={a} fillOpacity=".34" stroke={a} strokeWidth="2" filter={bevel(c)} />
          <path d="M150 83 L210 83 L204 69 L156 69 Z" fill={c.ref('glass')} />
          <path d="M145 67 L215 67" stroke="#f8fafc" strokeWidth="2.6" filter={c.ref('glow')} />
          {!c.still && <rect className="nvf-scan" x="150" y="69" width="7" height="14" fill="#fff" opacity=".6" />}
          <path d="M180 45 L180 24 M172 45 L165 32 M188 45 L195 32" stroke={a} strokeWidth="2" strokeLinecap="round" />
          <circle cx="180" cy="22" r="3" fill="#f8fafc" filter={c.ref('glow')} />
        </g>
      );
    case 'halo':
      return (
        <g filter={c.ref('glow')}>
          <g className={anim(c, 'nvf-pulse')}>
            <ellipse cx="180" cy="36" rx="42" ry="10.5" fill="none" stroke={a} strokeWidth="3" />
            <ellipse cx="180" cy="36" rx="33" ry="7.5" fill="none" stroke="#f8fafc" strokeOpacity=".75" strokeWidth="1.2" />
          </g>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const t = (i / 6) * Math.PI * 2;
            return <circle key={i} cx={180 + Math.cos(t) * 42} cy={36 + Math.sin(t) * 10.5} r="2.2" fill="#f8fafc" className={anim(c, 'nvf-blink')} style={{ animationDelay: `${i * 0.45}s` }} />;
          })}
        </g>
      );
    case 'aegis':
      return (
        <g>
          <path d="M143 80 L118 50 L148 66 Z M217 80 L242 50 L212 66 Z" fill={c.ref('metalV')} stroke={a} strokeWidth="1.6" />
          <path d="M156 66 L136 24 L162 52 Z M204 66 L224 24 L198 52 Z" fill={c.ref('metalV')} stroke={a} strokeWidth="1.8" filter={bevel(c)} />
          <path d="M180 58 L193 22 L180 -4 L167 22 Z" fill={a} stroke="#f8fafc" strokeWidth="1.5" filter={c.ref('glow')} className={anim(c, 'nvf-pulse')} />
          <path d="M180 56 L180 2" stroke="#fff" strokeOpacity=".6" strokeWidth=".9" />
          <path d="M141 86 L127 62 M219 86 L233 62" stroke={a} strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
}

// ── Armor overlays (drawn over the base torso and shoulder guards) ───────────
export function Armor({ id, c }: { id: string; c: PartCtx }): ReactNode {
  const a = c.accent;
  switch (id) {
    case 'plated':
      return (
        <g stroke="#94a3b8" strokeWidth="1.4" strokeLinejoin="round">
          <path d="M150 170 L180 182 L210 170 L217 197 L180 212 L143 197 Z" fill={c.ref('metalV')} fillOpacity=".78" filter={bevel(c)} />
          <path d="M157 224 L203 224 M159 232 L201 232" fill="none" stroke="#475569" strokeWidth="1.6" />
          <path d="M146 238 L214 238 L208 254 L152 254 Z" fill={c.ref('dark')} />
          <path d="M168 239 L192 239 L186 253 L174 253 Z" fill={a} fillOpacity=".7" stroke={a} />
          <Sym>
            <path d="M126 176 L107 189 L113 207 L133 198 Z" fill={c.ref('metalV')} filter={bevel(c)} />
            <circle cx="137" cy="187" r="2.4" fill={a} stroke="none" />
            <path d="M142 192 L151 214" fill="none" stroke={a} strokeWidth="1.6" opacity=".85" />
          </Sym>
        </g>
      );
    case 'pulse':
      return (
        <g>
          <Sym>
            <path d="M124 181 L143 167 L155 190 L144 218 L126 205 Z" fill={a} fillOpacity=".34" stroke={a} strokeWidth="1.6" filter={bevel(c)} />
            <Flow d="M143 174 L132 204 L145 246" c={c} />
          </Sym>
          <Flow d="M155 229 L180 239 L205 229" c={c} w={2.2} />
          <path d="M163 200 L180 208 L197 200" fill="none" stroke={a} strokeWidth="1.4" opacity=".8" />
        </g>
      );
    case 'bulwark':
      return (
        <g stroke="#cbd5e1" strokeWidth="1.6" strokeLinejoin="round">
          <Sym>
            <path d="M121 164 L90 181 L95 199 L127 191 Z" fill={c.ref('metalV')} filter={bevel(c)} />
            <path d="M119 193 L92 205 L100 222 L130 213 Z" fill={c.ref('metalV')} filter={bevel(c)} />
            <path d="M97 224 L84 247 L98 258 L110 237 Z" fill={c.ref('dark')} />
            <path d="M101 190 L122 196" stroke={a} strokeWidth="2.2" fill="none" />
          </Sym>
          <path d="M150 171 L210 171 L205 209 L180 224 L155 209 Z" fill={c.ref('dark')} fillOpacity=".88" stroke={a} />
          <path d="M180 181 L193 204 L167 204 Z" fill="none" stroke={a} strokeWidth="1.8" filter={c.ref('glow')} />
          <path d="M162 160 L180 170 L198 160" fill="none" stroke="#94a3b8" strokeWidth="3" />
        </g>
      );
    case 'vanguard':
      return (
        <g stroke="#f8fafc" strokeWidth="1.5" strokeLinejoin="round">
          <Sym>
            <path d="M119 170 L99 142 L110 176 L93 204 L128 221 L147 196 Z" fill={c.ref('metalV')} filter={bevel(c)} />
            <path d="M107 183 L124 192" stroke={a} strokeWidth="2" fill="none" />
            <path d="M147 258 L129 296 L156 287 L168 263 Z" fill={c.ref('metalV')} filter={bevel(c)} />
            <path d="M138 270 L152 266" stroke={a} strokeWidth="1.6" fill="none" />
          </Sym>
          <path d="M159 159 L180 174 L201 159 L197 150 L180 163 L163 150 Z" fill={a} filter={c.ref('glow')} />
          <path d="M180 192 L196 222 L164 222 Z" fill="none" stroke={a} strokeWidth="2" filter={c.ref('glow')} className={anim(c, 'nvf-pulse')} />
          <path d="M180 200 L180 216" stroke="#fff" strokeOpacity=".7" strokeWidth="1.2" />
        </g>
      );
    default:
      return null;
  }
}

// ── Back modules (drawn behind the body) ─────────────────────────────────────
export function Back({ id, c }: { id: string; c: PartCtx }): ReactNode {
  const a = c.accent;
  switch (id) {
    case 'antenna':
      return (
        <g strokeLinecap="round" fill="none">
          <Sym>
            <path d="M143 180 L115 62" stroke="#94a3b8" strokeWidth="3.4" />
            <path d="M148 188 L130 98" stroke="#64748b" strokeWidth="2.4" />
            <circle cx="143" cy="181" r="5.5" fill={c.ref('dark')} stroke={a} strokeWidth="1.5" />
            <circle cx="115" cy="58" r="5" fill={a} stroke="none" filter={c.ref('glow')} className={anim(c, 'nvf-blink')} />
            <circle cx="130" cy="94" r="3.4" fill="#f8fafc" stroke="none" filter={c.ref('glow')} className={anim(c, 'nvf-blink')} style={{ animationDelay: '.8s' }} />
          </Sym>
        </g>
      );
    case 'crawler': {
      const legs: [string, [number, number], [number, number]][] = [
        ['M138 182 Q94 150 72 98 L66 84', [86, 130], [66, 84]],
        ['M134 198 Q80 190 52 150 L44 136', [66, 176], [44, 136]],
        ['M130 214 Q70 220 40 186 L30 172', [58, 208], [30, 172]],
      ];
      return (
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" className={anim(c, 'nvf-sway')}>
          <Sym>
            {legs.map(([d, joint, tip], i) => (
              <g key={i}>
                <path d={d} stroke="#475569" strokeWidth="6.5" />
                <path d={d} stroke="#94a3b8" strokeWidth="3" />
                <path d={d} stroke={a} strokeWidth="1.3" opacity=".9" />
                <circle cx={joint[0]} cy={joint[1]} r="4.2" fill={c.ref('dark')} stroke={a} strokeWidth="1.4" />
                <path d={`M${tip[0]} ${tip[1]} l-6 -11 l12 6 Z`} fill={a} stroke="none" filter={c.ref('glow')} />
              </g>
            ))}
          </Sym>
        </g>
      );
    }
    case 'wings': {
      const blades = [
        'M146 178 L50 104 L68 150 Z', 'M146 186 L24 140 L52 178 Z', 'M146 194 L18 190 L54 210 Z',
        'M146 202 L32 238 L68 230 Z', 'M146 210 L56 272 L88 246 Z',
      ];
      return (
        <g className={anim(c, 'nvf-wing')}>
          <Sym>
            {blades.map((d, i) => (
              <g key={i}>
                <path d={d} fill={c.ref('wing')} stroke={a} strokeWidth="1.5" strokeLinejoin="round" />
                <path d={d} fill="none" stroke="#f8fafc" strokeOpacity=".4" strokeWidth=".8" strokeDasharray="2 5" />
              </g>
            ))}
            <path d="M146 178 L50 104 M146 186 L24 140 M146 194 L18 190" stroke={a} strokeWidth="1" opacity=".55" fill="none" filter={c.ref('glow')} />
          </Sym>
        </g>
      );
    }
    default:
      return null;
  }
}

// ── Weapons (held in the right hand) ─────────────────────────────────────────
export function Weapon({ id, c }: { id: string; c: PartCtx }): ReactNode {
  const a = c.accent;
  switch (id) {
    case 'blade':
      return (
        <g>
          <path d="M262 244 L277 232" stroke={c.ref('dark')} strokeWidth="8" strokeLinecap="round" />
          <path d="M257 226 L288 242" stroke="#fbbf24" strokeWidth="5.5" strokeLinecap="round" />
          <g filter={c.ref('bloom')} className={anim(c, 'nvf-pulse')}>
            <path d="M275 226 L295 138 Q298 130 301 138 L287 232 Z" fill={a} fillOpacity=".5" />
          </g>
          <path d="M275 226 L295 138 Q298 130 301 138 L287 232 Z" fill={c.ref('blade')} stroke={a} strokeWidth="1.8" />
          <path d="M283 224 L297 146" stroke="#fff" strokeOpacity=".85" strokeWidth="1.4" />
          <Flow d="M281 214 L296 150" c={c} w={1.2} op={0.7} />
        </g>
      );
    case 'staff':
      return (
        <g>
          <path d="M272 264 L288 126" stroke="#475569" strokeWidth="7" strokeLinecap="round" />
          <path d="M272 264 L288 126" stroke="#94a3b8" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M276 232 L283 228 M279 204 L286 200 M282 176 L289 172" stroke={a} strokeWidth="2.4" />
          <g className={anim(c, 'nvf-spin-slow')}>
            <circle cx="289" cy="112" r="16" fill="none" stroke={a} strokeWidth="2.2" strokeDasharray="10 6" filter={c.ref('glow')} />
          </g>
          <circle cx="289" cy="112" r="11" fill="none" stroke="#f8fafc" strokeOpacity=".6" strokeWidth="1" />
          <circle cx="289" cy="112" r="6.5" fill="#f8fafc" stroke={a} strokeWidth="1.5" filter={c.ref('bloom')} className={anim(c, 'nvf-pulse')} />
          <Flow d="M289 112 L308 96 L300 84 L318 70" c={c} w={1.3} op={0.7} />
        </g>
      );
    case 'lance':
      return (
        <g>
          <path d="M270 268 L298 102" stroke="#475569" strokeWidth="6.5" strokeLinecap="round" />
          <path d="M270 268 L298 102" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
          <path d="M283 190 L300 196 M287 168 L304 172" stroke={a} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M298 104 L312 58 L291 100 Z" fill={c.ref('blade')} stroke={a} strokeWidth="1.8" filter={c.ref('glow')} />
          <path d="M293 122 Q316 130 308 156 Q300 138 291 146 Z" fill={a} fillOpacity=".7" stroke={a} strokeWidth="1" className={anim(c, 'nvf-sway')} />
          <Flow d="M297 110 L308 74" c={c} w={1.2} op={0.8} />
        </g>
      );
    default:
      return null;
  }
}

// ── Auras ────────────────────────────────────────────────────────────────────
export function AuraBack({ id, c }: { id: string; c: PartCtx }): ReactNode {
  const a = c.accent;
  if (id === 'ring') {
    return (
      <g>
        <ellipse cx="180" cy="222" rx="150" ry="38" fill="none" stroke={a} strokeOpacity=".5" strokeWidth="2" filter={c.ref('glow')} />
        <ellipse cx="180" cy="222" rx="128" ry="29" fill="none" stroke="#f8fafc" strokeOpacity=".22" strokeWidth="1" strokeDasharray="3 9" />
        {!c.still && (
          <>
            <circle r="4.5" fill="#f8fafc" filter={c.ref('glow')}><animateMotion dur="7s" repeatCount="indefinite" path="M30 222 A150 38 0 1 1 330 222 A150 38 0 1 1 30 222" /></circle>
            <circle r="3" fill={a} filter={c.ref('glow')}><animateMotion dur="11s" repeatCount="indefinite" path="M52 222 A128 29 0 1 0 308 222 A128 29 0 1 0 52 222" /></circle>
          </>
        )}
      </g>
    );
  }
  if (id === 'nebula') {
    const stars = Array.from({ length: 16 }, (_, i) => ({ x: 24 + ((i * 97) % 312), y: 20 + ((i * 61) % 360), r: 0.9 + (i % 3) * 0.6, d: (i * 0.37) % 3 }));
    return (
      <g>
        <ellipse cx="180" cy="200" rx="170" ry="188" fill={c.ref('nebula')} className={anim(c, 'nvf-pulse')} />
        <g className={anim(c, 'nvf-spin-slow')} fill="none" stroke={a} strokeOpacity=".38" strokeWidth="1.4">
          <path d="M40 200 Q100 60 220 80" /><path d="M320 210 Q260 340 140 320" /><path d="M70 300 Q40 180 120 120" /><path d="M300 120 Q330 200 270 260" />
        </g>
        <g fill="#f8fafc">
          {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity=".8" className={anim(c, 'nvf-blink')} style={{ animationDelay: `${s.d}s` }} />)}
        </g>
      </g>
    );
  }
  if (id === 'embers') {
    const dots = Array.from({ length: 20 }, (_, i) => ({ x: 34 + ((i * 53) % 292), y: 290 + ((i * 37) % 80), d: (i * 0.45) % 5, r: 1.4 + (i % 4) * 0.6 }));
    return (
      <g fill={a} filter={c.ref('glow')}>
        {dots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} opacity=".85" className={anim(c, 'nvf-rise')} style={{ animationDelay: `${p.d}s` }} />)}
      </g>
    );
  }
  return null;
}

/** The part of the orbit ring that passes in front of the body. */
export function AuraFront({ id, c }: { id: string; c: PartCtx }): ReactNode {
  if (id !== 'ring') return null;
  return <path d="M30 222 A150 38 0 0 0 330 222" fill="none" stroke={c.accent} strokeOpacity=".8" strokeWidth="2.6" filter={c.ref('glow')} />;
}
