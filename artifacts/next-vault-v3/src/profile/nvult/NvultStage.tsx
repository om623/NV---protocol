// ── Nvult stage: holographic platform, light, parallax and equip feedback ─────
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useAnimationControls, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

const CSS = `
.nvs-dash{animation:nvs-dash 7s linear infinite}
.nvs-dash-r{animation:nvs-dash 11s linear infinite reverse}
.nvs-rise{animation:nvs-rise 8s ease-in infinite}
.nvs-beam{animation:nvs-beam 5.5s ease-in-out infinite}
@keyframes nvs-dash{to{stroke-dashoffset:-60}}
@keyframes nvs-rise{0%{transform:translateY(0) scale(.6);opacity:0}12%{opacity:.8}100%{transform:translateY(-260px) scale(1);opacity:0}}
@keyframes nvs-beam{0%,100%{opacity:.55}50%{opacity:.9}}
@media (prefers-reduced-motion:reduce){.nvs-dash,.nvs-dash-r,.nvs-rise,.nvs-beam{animation:none}}
`;

const PARTICLES = Array.from({ length: 16 }, (_, i) => ({ left: 8 + ((i * 53) % 84), size: 2 + (i % 3), delay: (i * 0.9) % 8, dur: 6 + (i % 5) }));

export interface StageProps {
  accent: string;
  children: ReactNode;
  /** Changes whenever the look changes: triggers the equip feedback. */
  changeKey: string;
  /** Short message shown (and announced to screen readers) after a change. */
  announce?: string;
  /** Pointer parallax tilt. */
  interactive?: boolean;
  /** Fixed layer on top of the stage (does not tilt), e.g. a preview badge. */
  overlay?: ReactNode;
  /** True when the real 3D scene is on screen: it brings its own pedestal, light and particles, and is turned by dragging. */
  scene3d?: boolean;
  className?: string;
}

export function NvultStage({ accent, children, changeKey, announce = '', interactive = true, overlay, scene3d = false, className = '' }: StageProps) {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-1, 1], [-9, 9]), { stiffness: 110, damping: 16 });
  const rotX = useSpring(useTransform(my, [-1, 1], [6, -6]), { stiffness: 110, damping: 16 });
  const flash = useAnimationControls();
  const [pulse, setPulse] = useState(0);
  const [toast, setToast] = useState('');
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPulse((p) => p + 1);
    if (!reduce) void flash.start(scene3d ? { filter: ['brightness(1.25)', 'brightness(1)'], transition: { duration: 0.5, ease: 'easeOut' } } : { filter: ['brightness(1.7) saturate(1.3)', 'brightness(1) saturate(1)'], scale: [1.04, 1], transition: { duration: 0.55, ease: 'easeOut' } });
  }, [changeKey, flash, reduce, scene3d]);

  useEffect(() => {
    if (!announce) return;
    setToast(announce);
    const id = window.setTimeout(() => setToast(''), 1900);
    return () => window.clearTimeout(id);
  }, [announce, pulse]);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || reduce || e.pointerType === 'touch') return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const leave = () => { mx.set(0); my.set(0); };

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} data-testid="nvult-stage" data-pulse={pulse}
      className={`relative isolate overflow-hidden rounded-2xl border border-white/[.07] ${className}`}
      style={{ background: 'linear-gradient(180deg,#0b121b 0%,#070a0e 100%)', perspective: 900 }}>
      <style>{CSS}</style>

      {/* Dome light + vertical beam */}
      <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(62% 52% at 50% 36%, ${accent}33, transparent 72%), radial-gradient(40% 30% at 50% 100%, ${accent}22, transparent 70%)` }} />
      {!scene3d && <div aria-hidden className="nvs-beam absolute inset-y-0 left-1/2 w-[46%] -translate-x-1/2"
        style={{ background: `linear-gradient(180deg, transparent 0%, ${accent}14 30%, ${accent}1f 60%, transparent 100%)`, maskImage: 'linear-gradient(90deg,transparent,#000 40%,#000 60%,transparent)', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 40%,#000 60%,transparent)' }} />}
      {/* Faint floor grid in perspective */}
      {!scene3d && <div aria-hidden className="absolute inset-x-0 bottom-0 h-[34%] opacity-40"
        style={{ backgroundImage: `linear-gradient(${accent}33 1px, transparent 1px), linear-gradient(90deg, ${accent}26 1px, transparent 1px)`, backgroundSize: '34px 22px', transform: 'perspective(260px) rotateX(58deg)', transformOrigin: 'bottom', maskImage: 'linear-gradient(0deg,#000,transparent)', WebkitMaskImage: 'linear-gradient(0deg,#000,transparent)' }} />}

      {/* Particles */}
      {!reduce && !scene3d && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[10%] h-[70%]">
          {PARTICLES.map((p, i) => (
            <span key={i} className="nvs-rise absolute bottom-0 rounded-full" style={{ left: `${p.left}%`, width: p.size, height: p.size, background: accent, boxShadow: `0 0 8px ${accent}`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
          ))}
        </div>
      )}

      {/* Platform */}
      {!scene3d && <svg aria-hidden viewBox="0 0 400 120" className="absolute inset-x-0 bottom-[2%] w-full">
        <defs><radialGradient id="nvs-floor"><stop offset="0" stopColor={accent} stopOpacity=".45" /><stop offset="1" stopColor={accent} stopOpacity="0" /></radialGradient></defs>
        <ellipse cx="200" cy="66" rx="170" ry="38" fill="url(#nvs-floor)" />
        <ellipse cx="200" cy="66" rx="150" ry="30" fill="none" stroke={accent} strokeOpacity=".55" strokeWidth="1.6" />
        <ellipse cx="200" cy="66" rx="118" ry="22" fill="none" stroke={accent} strokeOpacity=".7" strokeWidth="1.4" strokeDasharray="14 10" className="nvs-dash" />
        <ellipse cx="200" cy="66" rx="86" ry="15" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="1" strokeDasharray="4 8" className="nvs-dash-r" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const t = (i / 8) * Math.PI * 2; return <circle key={i} cx={200 + Math.cos(t) * 150} cy={66 + Math.sin(t) * 30} r="2" fill={accent} />; })}
      </svg>}

      {/* Character (tilts with the pointer; flashes on change) */}
      <motion.div className={scene3d ? 'absolute inset-0' : 'absolute inset-x-[-7%] bottom-[6%] top-[-4%] flex items-end justify-center'}
        style={scene3d ? undefined : { rotateX: reduce ? 0 : rotX, rotateY: reduce ? 0 : rotY, transformStyle: 'preserve-3d' }}>
        <motion.div animate={flash} className={scene3d ? 'h-full w-full' : 'h-full w-full max-w-[420px]'}>{children}</motion.div>
      </motion.div>

      {/* Equip feedback: light sweep + floor shockwave */}
      <AnimatePresence>
        {pulse > 0 && !reduce && (
          <motion.div key={`sweep-${pulse}`} aria-hidden initial={{ y: '105%', opacity: 0.9 }} animate={{ y: '-25%', opacity: 0 }} transition={{ duration: 0.85, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-x-0 h-24"
            style={{ background: `linear-gradient(180deg, transparent, ${accent}55 45%, #ffffff66 50%, ${accent}55 55%, transparent)` }} />
        )}
        {pulse > 0 && !reduce && !scene3d && (
          <motion.div key={`ring-${pulse}`} aria-hidden initial={{ scale: 0.35, opacity: 0.8 }} animate={{ scale: 1.5, opacity: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }}
            className="pointer-events-none absolute bottom-[5%] left-1/2 h-[18%] w-[70%] -translate-x-1/2 rounded-[50%] border-2" style={{ borderColor: accent }} />
        )}
      </AnimatePresence>

      {overlay}

      {/* Visible confirmation (also announced politely to assistive tech) */}
      <div role="status" aria-live="polite" className="sr-only">{announce}</div>
      <AnimatePresence>
        {toast && (
          <motion.div key={toast} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
            className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border px-3 py-1 text-[11px] font-medium text-foreground backdrop-blur-md"
            style={{ borderColor: `${accent}66`, background: `${accent}1f`, boxShadow: `0 0 18px ${accent}33` }} data-testid="stage-toast">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
