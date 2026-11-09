// ── Nvult figure v2: the original cybernetic humanoid with real light and volume ─
import { useId } from 'react';
import { useReducedMotion } from 'framer-motion';
import { accentHex, finishFor, tierOf } from './catalog';
import type { Loadout } from './loadout';
import { Armor, AuraBack, AuraFront, Back, Head, Sym, Weapon, type PartCtx, type RefName } from './parts';

export type FigureFocus = 'full' | 'head' | 'armor' | 'back' | 'weapon' | 'aura';

const VIEWBOX: Record<FigureFocus, string> = {
  full: '0 0 360 400',
  head: '112 -8 136 158',
  armor: '88 132 184 160',
  back: '8 40 344 230',
  weapon: '196 56 164 232',
  aura: '0 0 360 400',
};

const CSS = `
.nvf-float{animation:nvf-float 5.2s ease-in-out infinite}
.nvf-breathe{animation:nvf-breathe 5.2s ease-in-out infinite;transform-origin:180px 262px}
.nvf-pulse{animation:nvf-pulse 2.8s ease-in-out infinite}
.nvf-blink{animation:nvf-blink 3.4s ease-in-out infinite}
.nvf-spin-slow{animation:nvf-spin 40s linear infinite;transform-box:fill-box;transform-origin:center}
.nvf-spin-core{animation:nvf-spin 12s linear infinite;transform-box:fill-box;transform-origin:center}
.nvf-rise{animation:nvf-rise 4.6s ease-in infinite}
.nvf-wing{animation:nvf-wing 4.4s ease-in-out infinite;transform-origin:180px 190px}
.nvf-sway{animation:nvf-sway 5s ease-in-out infinite;transform-origin:180px 190px}
.nvf-sheen{animation:nvf-sheen 6s ease-in-out infinite}
.nvf-shard{animation:nvf-float 4s ease-in-out infinite}
.nvf-flow{animation:nvf-flow 1.5s linear infinite}
.nvf-scan{animation:nvf-scan 3.2s ease-in-out infinite}
@keyframes nvf-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes nvf-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.012,1.006)}}
@keyframes nvf-pulse{0%,100%{opacity:.72}50%{opacity:1}}
@keyframes nvf-blink{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes nvf-spin{to{transform:rotate(360deg)}}
@keyframes nvf-rise{0%{transform:translateY(0);opacity:0}15%{opacity:.9}100%{transform:translateY(-120px);opacity:0}}
@keyframes nvf-wing{0%,100%{transform:scaleX(1)}50%{transform:scaleX(1.03)}}
@keyframes nvf-sway{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}}
@keyframes nvf-sheen{0%,35%{transform:translateX(-200px)}70%,100%{transform:translateX(220px)}}
@keyframes nvf-flow{to{stroke-dashoffset:-24}}
@keyframes nvf-scan{0%,100%{transform:translateX(0)}50%{transform:translateX(46px)}}
@media (prefers-reduced-motion:reduce){.nvf-float,.nvf-breathe,.nvf-pulse,.nvf-blink,.nvf-spin-slow,.nvf-spin-core,.nvf-rise,.nvf-wing,.nvf-sway,.nvf-sheen,.nvf-shard,.nvf-flow,.nvf-scan{animation:none}}
`;

const SHARDS: [number, number][] = [[64, 128], [296, 104], [58, 262], [304, 276], [92, 66], [268, 62]];

export interface FigureProps {
  loadout: Loadout;
  skinId: string;
  level: number;
  focus?: FigureFocus;
  /** Disables all motion (used by thumbnails and static previews). */
  still?: boolean;
  label: string;
  className?: string;
}

export function NvultFigure({ loadout, skinId, level, focus = 'full', still = false, label, className }: FigureProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduce = useReducedMotion();
  const quiet = still || !!reduce;
  const lite = focus !== 'full';
  const accent = accentHex(loadout.accent);
  const fin = finishFor(skinId);
  const tier = tierOf(level);
  const ref = (n: RefName) => `url(#${uid}-${n})`;
  const c: PartCtx = { accent, ref, still: quiet, lite };
  const bv = lite ? undefined : ref('bevel');
  const sx = loadout.style === 'sleek' ? 0.92 : loadout.style === 'heavy' ? 1.12 : 1;
  const upper = `translate(180 210) scale(${sx} 1) translate(-180 -210)`;
  const coreOpacity = Math.min(1, 0.66 + tier * 0.06);
  const shards = Math.max(0, Math.min(6, tier - 1));
  const a = (cls: string) => (quiet ? undefined : cls);

  return (
    <svg viewBox={VIEWBOX[focus]} role="img" aria-label={label} className={className} style={{ overflow: 'visible' }}>
      <style>{CSS}</style>
      <defs>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={fin.c0} /><stop offset=".22" stopColor={fin.c1} /><stop offset=".58" stopColor={fin.c2} /><stop offset="1" stopColor={fin.c3} />
        </linearGradient>
        <linearGradient id={`${uid}-metalV`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fin.c0} /><stop offset=".3" stopColor={fin.c1} /><stop offset=".72" stopColor={fin.c2} /><stop offset="1" stopColor={fin.c3} />
        </linearGradient>
        <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2=".9" y2="1">
          <stop offset="0" stopColor="#4b5b72" /><stop offset=".45" stopColor="#172033" /><stop offset="1" stopColor="#020617" />
        </linearGradient>
        <linearGradient id={`${uid}-core`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" /><stop offset=".25" stopColor={accent} /><stop offset="1" stopColor={accent} stopOpacity=".35" />
        </linearGradient>
        <linearGradient id={`${uid}-wing`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={accent} stopOpacity=".06" /><stop offset="1" stopColor={accent} stopOpacity=".55" />
        </linearGradient>
        <linearGradient id={`${uid}-blade`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={accent} /><stop offset=".55" stopColor="#f8fafc" /><stop offset="1" stopColor="#fff" />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity=".55" /><stop offset=".5" stopColor={accent} stopOpacity=".12" /><stop offset="1" stopColor="#fff" stopOpacity=".25" />
        </linearGradient>
        <radialGradient id={`${uid}-halo`}><stop offset="0" stopColor={accent} stopOpacity=".3" /><stop offset="1" stopColor={accent} stopOpacity="0" /></radialGradient>
        <radialGradient id={`${uid}-coreGlow`}><stop offset="0" stopColor={accent} stopOpacity=".55" /><stop offset="1" stopColor={accent} stopOpacity="0" /></radialGradient>
        <radialGradient id={`${uid}-nebula`}><stop offset="0" stopColor={accent} stopOpacity=".28" /><stop offset=".6" stopColor="#7c3aed" stopOpacity=".12" /><stop offset="1" stopColor={accent} stopOpacity="0" /></radialGradient>
        <linearGradient id={`${uid}-sheenGrad`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".45" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id={`${uid}-bloom`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id={`${uid}-bevel`} x="-4%" y="-4%" width="108%" height="108%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="bl" />
          <feSpecularLighting in="bl" surfaceScale="4" specularConstant=".9" specularExponent="22" lightingColor="#ffffff" result="sp"><feDistantLight azimuth="225" elevation="52" /></feSpecularLighting>
          <feComposite in="sp" in2="SourceAlpha" operator="in" result="spIn" />
          <feComposite in="SourceGraphic" in2="spIn" operator="arithmetic" k1="0" k2="1" k3=".55" k4="0" />
        </filter>
        <clipPath id={`${uid}-torso`}><path d="M145 158 L215 158 L234 190 L221 259 Q180 284 139 259 L126 190 Z" /></clipPath>
      </defs>

      <ellipse cx="180" cy="196" rx="146" ry="170" fill={`url(#${uid}-halo)`} opacity=".6" />
      <ellipse cx="180" cy="366" rx="86" ry="11" fill={accent} opacity=".2" filter={ref('glow')} />
      <ellipse cx="180" cy="366" rx="54" ry="6" fill="#fff" opacity=".1" />
      <AuraBack id={loadout.aura} c={c} />

      <g className={a('nvf-float')}>
        <g transform={upper}>
          <Back id={loadout.back} c={c} />

          {/* Legs: thighs, knee guards, shins, boots and energy conduits (stretched 10% for a heroic stance) */}
          <g transform="translate(0 262) scale(1 1.1) translate(0 -262)">
          <g stroke="#64748b" strokeWidth="1.8" strokeLinejoin="round">
            <Sym>
              <path d="M143 259 L169 267 L165 307 L151 331 L128 327 L136 297 Z" fill={ref('metalV')} filter={bv} />
              <path d="M146 267 L166 273 L163 297 L148 293 Z" fill={ref('dark')} fillOpacity=".55" stroke="none" />
              <path d="M141 298 L151 292 L161 298 L161 311 L151 317 L141 311 Z" fill={ref('dark')} stroke={accent} strokeWidth="1.4" />
              <path d="M128 327 L151 331 L149 345 L119 352 L109 346 L116 335 Z" fill={ref('dark')} filter={bv} />
              <path d="M119 352 L109 346 L116 335 L127 340 Z" fill={ref('metalV')} stroke="none" />
              <path d="M146 318 L151 329" stroke="#94a3b8" strokeWidth="1.4" fill="none" />
              <path d="M139 282 L166 289" fill="none" stroke={accent} strokeWidth="2" />
              <rect x="124" y="346" width="10" height="2.4" rx="1" fill={accent} stroke="none" opacity=".9" />
            </Sym>
          </g>
          <Sym><path d="M153 270 L156 291 M150 320 L142 341" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 7" className={a('nvf-flow')} opacity=".9" /></Sym>
          <g fill="#0f172a" stroke={accent} strokeWidth="1.5">
            <circle cx="151" cy="304" r="3" fill={accent} /><circle cx="209" cy="304" r="3" fill={accent} />
          </g>
          </g>

          {/* Arms: upper arm, forearm guard, fist and shoulder joint */}
          <g stroke="#94a3b8" strokeWidth="1.8" strokeLinejoin="round">
            <Sym>
              <path d="M130 174 L106 186 L89 220 L100 234 L116 224 L135 201 Z" fill={ref('metalV')} filter={bv} />
              <path d="M100 234 L89 220 L98 210 L112 226 Z" fill={ref('dark')} fillOpacity=".6" stroke="none" />
              <path d="M89 220 L78 244 L89 253 L101 234 Z" fill={ref('dark')} />
              <path d="M81 246 L92 250 M84 240 L94 244" stroke="#64748b" strokeWidth="1.2" fill="none" />
            </Sym>
          </g>
          <Sym><path d="M122 193 L103 222" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 7" className={a('nvf-flow')} opacity=".9" /></Sym>
          <g fill="#0f172a" stroke={accent} strokeWidth="1.5">
            <circle cx="109" cy="191" r="7" /><circle cx="251" cy="191" r="7" />
            <circle cx="109" cy="191" r="2.6" fill={accent} /><circle cx="251" cy="191" r="2.6" fill={accent} />
          </g>
          <path d="M132 165 L111 178 L121 206 L143 218 L155 190 Z M228 165 L249 178 L239 206 L217 218 L205 190 Z" fill={ref('metalV')} stroke="#94a3b8" strokeWidth="1.6" filter={bv} />
          <path d="M126 172 L112 181 M234 172 L248 181" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" fill="none" />

          {/* Torso: shell, chest plate, reactor, abdomen and hip plate */}
          <path d="M146 158 L164 149 L196 149 L214 158 Z" fill={ref('dark')} stroke="#475569" strokeWidth="1.2" />
          <path d="M145 158 L215 158 L234 190 L221 259 Q180 284 139 259 L126 190 Z" fill={ref('dark')} stroke={accent} strokeOpacity=".75" strokeWidth="2" />
          <path d="M148 169 L180 181 L212 169 L222 197 L207 246 L180 260 L153 246 L138 197 Z" fill={ref('metalV')} stroke="#cbd5e1" strokeOpacity=".8" strokeWidth="1.5" filter={bv} />
          <path d="M150 173 L180 184 L210 173" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1.2" />
          <path d="M151 183 L180 193 L209 183 L202 213 L180 227 L158 213 Z" fill="#0b1220" stroke={accent} strokeWidth="1.5" />
          <circle cx="180" cy="207" r="34" fill={`url(#${uid}-coreGlow)`} opacity={coreOpacity} className={a('nvf-pulse')} />
          <circle cx="180" cy="207" r="19" fill="none" stroke={accent} strokeOpacity=".8" strokeWidth="1.2" strokeDasharray="3 6" className={a('nvf-spin-core')} />
          <g opacity={coreOpacity} className={a('nvf-pulse')}>
            <path d="M180 193 L195 207 L180 222 L165 207 Z" fill={ref('core')} stroke="#ecfeff" strokeWidth="1.4" filter={ref('glow')} />
            <path d="M180 193 L180 222 M165 207 L195 207" stroke="#fff" strokeOpacity=".5" strokeWidth=".8" />
          </g>
          <path d="M151 229 L164 239 L180 234 L196 239 L209 229" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M159 247 L201 247 M162 253 L198 253" stroke="#475569" strokeWidth="1.6" fill="none" />
          <path d="M150 258 L210 258 L204 273 L156 273 Z" fill={ref('dark')} stroke="#64748b" strokeWidth="1.4" />
          <path d="M172 262 L188 262 L184 270 L176 270 Z" fill={accent} fillOpacity=".7" stroke={accent} strokeWidth="1" />
          {fin.shine && !quiet && (
            <g clipPath={`url(#${uid}-torso)`}><rect className="nvf-sheen" x="140" y="150" width="46" height="140" fill={`url(#${uid}-sheenGrad)`} transform="skewX(-18)" /></g>
          )}
          {tier >= 2 && <circle cx="180" cy="207" r="25" fill="none" stroke={accent} strokeOpacity=".6" strokeWidth="1.2" strokeDasharray="2 5" />}
          {tier >= 1 && <><circle cx="127" cy="174" r="2.8" fill={accent} filter={ref('glow')} /><circle cx="233" cy="174" r="2.8" fill={accent} filter={ref('glow')} /></>}
          {tier >= 3 && <path d="M112 176 L96 160 L108 182 Z M248 176 L264 160 L252 182 Z" fill={ref('metalV')} stroke={accent} strokeWidth="1.2" />}
          {tier >= 5 && <path d="M156 196 L146 214 M204 196 L214 214" stroke={accent} strokeWidth="1.8" strokeLinecap="round" filter={ref('glow')} />}

          {/* Rim light from the upper right: gives every edge a lit side */}
          <g fill="none" stroke={accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" opacity=".55" filter={ref('glow')}>
            <path d="M215 160 L234 190 L221 259" /><path d="M254 186 L271 220" /><path d="M232 327 L224 297 L217 259" />
          </g>

          <Armor id={loadout.armor} c={c} />
          <Weapon id={loadout.weapon} c={c} />
        </g>

        {/* Neck and head (not scaled by body style); slightly smaller for heroic proportions */}
        <g transform="translate(180 150) scale(.93) translate(-180 -150)">
        <path d="M164 143 L164 163 L196 163 L196 143 Z" fill={ref('dark')} stroke="#94a3b8" strokeWidth="1.5" />
        <path d="M166 148 L194 148 M166 153 L194 153 M166 158 L194 158" stroke="#64748b" strokeWidth="1.1" />
        {tier >= 4 && <circle cx="180" cy="100" r="58" fill="none" stroke={accent} strokeOpacity=".35" strokeWidth="1.2" strokeDasharray="3 8" className={a('nvf-spin-slow')} />}
        <path d="M147 73 L160 57 L200 57 L213 73 L220 111 L208 143 L180 155 L152 143 L140 111 Z" fill={ref('metalV')} stroke="#cbd5e1" strokeWidth="2" filter={bv} />
        <path d="M147 73 L160 57 L200 57 M140 111 L147 73" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.3" />
        <path d="M152 138 L180 150 L208 138 L204 128 L180 138 L156 128 Z" fill={ref('dark')} stroke="#64748b" strokeWidth="1.2" />
        <path d="M151 84 L164 72 L196 72 L209 84 L206 109 L194 124 L166 124 L154 109 Z" fill="#020617" stroke="#64748b" strokeWidth="1.5" />
        <path d="M151 84 L164 72 L196 72 L209 84 L206 109 L194 124 L166 124 L154 109 Z" fill={ref('glass')} opacity=".7" />
        <path d="M158 80 L168 76 M154 100 L158 92" stroke="#fff" strokeOpacity=".4" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M159 94 L173 94 M187 94 L201 94" stroke={accent} strokeWidth="7" strokeLinecap="round" filter={ref('bloom')} className={a('nvf-pulse')} />
        <path d="M159 94 L173 94 M187 94 L201 94" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
        <path d="M169 113 L180 117 L191 113" stroke="#cbd5e1" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M145 90 L135 99 L136 116 L145 122 M215 90 L225 99 L224 116 L215 122" fill={ref('dark')} stroke="#94a3b8" strokeWidth="2" />
        <circle cx="140" cy="107" r="2" fill={accent} /><circle cx="220" cy="107" r="2" fill={accent} />
        <path d="M213 73 L220 111 L208 143" fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" opacity=".55" filter={ref('glow')} />
        <Head id={loadout.head} c={c} />
        </g>

        {Array.from({ length: shards }, (_, i) => {
          const [x, y] = SHARDS[i];
          return <path key={i} d={`M${x} ${y - 8} L${x + 5.5} ${y} L${x} ${y + 8} L${x - 5.5} ${y} Z`} fill={accent} opacity=".85" filter={ref('glow')} className={a('nvf-shard')} style={{ animationDelay: `${i * 0.7}s` }} />;
        })}
      </g>
      <AuraFront id={loadout.aura} c={c} />
    </svg>
  );
}
