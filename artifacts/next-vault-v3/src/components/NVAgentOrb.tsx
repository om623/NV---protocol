import { useEffect, useRef, useState } from 'react';
import { Bot, X } from 'lucide-react';

export function NVAgentOrb({ onOpen }: { onOpen: () => void }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState(false);
  const target = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0.035, y: 0.02 });
  const posRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const setInitial = () => {
      const x = Math.max(28, window.innerWidth - 86);
      const y = Math.max(90, window.innerHeight * 0.32);
      posRef.current = { x, y };
      target.current = { x, y };
      setPos({ x, y });
      setReady(true);
    };
    setInitial();

    let raf = 0;
    let last = performance.now();
    let nextTargetAt = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    const chooseTarget = () => {
      const margin = 34;
      target.current = {
        x: margin + Math.random() * Math.max(1, window.innerWidth - margin * 2),
        y: 84 + Math.random() * Math.max(1, window.innerHeight - 150),
      };
      nextTargetAt = performance.now() + 4500 + Math.random() * 6500;
    };

    const frame = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      if (!reduce.matches) {
        if (now > nextTargetAt) chooseTarget();
        const p = posRef.current;
        const dx = target.current.x - p.x;
        const dy = target.current.y - p.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        velocity.current.x += (dx / d) * 0.00022 * dt;
        velocity.current.y += (dy / d) * 0.00022 * dt;
        const speed = Math.hypot(velocity.current.x, velocity.current.y);
        const max = 0.075;
        if (speed > max) {
          velocity.current.x = velocity.current.x / speed * max;
          velocity.current.y = velocity.current.y / speed * max;
        }
        p.x += velocity.current.x * dt;
        p.y += velocity.current.y * dt;
        p.x = Math.max(28, Math.min(window.innerWidth - 28, p.x));
        p.y = Math.max(76, Math.min(window.innerHeight - 30, p.y));
        setPos({ x: p.x, y: p.y });
      }
      raf = requestAnimationFrame(frame);
    };
    chooseTarget();
    raf = requestAnimationFrame(frame);
    const resize = () => {
      posRef.current.x = Math.min(posRef.current.x, window.innerWidth - 28);
      posRef.current.y = Math.min(posRef.current.y, window.innerHeight - 30);
    };
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  if (!ready) return null;
  return (
    <div className="fixed z-[38] pointer-events-none" style={{ left: pos.x, top: pos.y, transform: 'translate(-50%,-50%)' }}>
      <button
        type="button"
        aria-label="Abrir NV Agent"
        title="NV Agent"
        onClick={() => { setHint(false); onOpen(); }}
        onPointerEnter={() => setHint(true)}
        onPointerLeave={() => setHint(false)}
        className="pointer-events-auto relative w-12 h-12 sm:w-14 sm:h-14 rounded-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <span className="absolute -inset-2 rounded-full blur-md opacity-70 animate-pulse bg-[conic-gradient(from_0deg,#00f5c8,#22d3ee,#a855f7,#00f5c8)]" />
        <span className="absolute inset-0 rounded-full animate-[spin_7s_linear_infinite] bg-[conic-gradient(from_0deg,#00f5c8,#22d3ee,#a855f7,#00f5c8)] p-[2px]">
          <span className="block w-full h-full rounded-full bg-[#071014]" />
        </span>
        <span className="absolute inset-[5px] rounded-full bg-gradient-to-br from-cyan-400/25 via-emerald-300/10 to-purple-500/30 border border-white/15 shadow-[inset_0_0_16px_rgba(34,211,238,.25)]" />
        <span className="absolute inset-0 flex items-center justify-center">
          <Bot size={22} className="text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,.9)] transition-colors duration-700 group-hover:text-purple-200" />
        </span>
        <span className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full bg-emerald-300 shadow-[0_0_10px_3px_rgba(110,231,183,.8)] animate-ping" />
      </button>
      {hint && (
        <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-16 whitespace-nowrap rounded-xl border border-cyan-400/20 bg-background/95 backdrop-blur-xl px-3 py-2 shadow-2xl">
          <button onClick={() => setHint(false)} className="absolute -right-1 -top-1 rounded-full bg-secondary p-0.5 text-muted-foreground"><X size={8}/></button>
          <div className="text-[10px] font-semibold text-foreground">NV Agent</div>
          <div className="text-[9px] text-muted-foreground/60">Toque para conversar</div>
        </div>
      )}
    </div>
  );
}
