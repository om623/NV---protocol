import { useEffect, useRef } from "react";

export function AnimatedDashboardObject() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) return;

    let frame = 0;
    let start = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - start) / 1000;

      const x =
        Math.sin(elapsed * 0.55) * 34 +
        Math.sin(elapsed * 0.21) * 18;

      const y =
        Math.cos(elapsed * 0.42) * 28 +
        Math.sin(elapsed * 0.73) * 12;

      const scale = 1 + Math.sin(elapsed * 1.1) * 0.035;

      el.style.transform =
        `translate3d(${x}px, ${y}px, 0) scale(${scale})`;

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed z-[20]"
      style={{
        left: "50%",
        top: "42%",
        width: "120px",
        height: "120px",
        transform: "translate3d(0,0,0)",
      }}
    >
      <div className="absolute inset-[-45px] rounded-full bg-primary/5 blur-3xl" />

      <div className="absolute inset-[15px] rounded-full border border-primary/20 animate-pulse" />

      <div className="absolute inset-[28px] rounded-full border border-primary/30" />

      <div
        className="absolute inset-[38px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,229,188,0.9) 0%, rgba(0,229,188,0.35) 28%, rgba(0,229,188,0.08) 58%, transparent 72%)",
          boxShadow:
            "0 0 25px rgba(0,229,188,0.55), 0 0 70px rgba(0,229,188,0.2)",
        }}
      />

      <span className="absolute left-[18px] top-[8px] h-1.5 w-1.5 rounded-full bg-primary/70" />
      <span className="absolute right-[12px] top-[38px] h-1 w-1 rounded-full bg-primary/50" />
      <span className="absolute left-[8px] bottom-[28px] h-1 w-1 rounded-full bg-primary/40" />
      <span className="absolute right-[25px] bottom-[8px] h-1.5 w-1.5 rounded-full bg-primary/60" />

      <svg
        className="absolute inset-[-25px] h-[170px] w-[170px] opacity-30"
        viewBox="0 0 170 170"
        fill="none"
      >
        <path
          d="M20 70 C55 15, 105 15, 150 70"
          stroke="currentColor"
          className="text-primary"
          strokeWidth="0.7"
        />
        <path
          d="M20 100 C55 155, 115 150, 150 92"
          stroke="currentColor"
          className="text-primary"
          strokeWidth="0.7"
        />
      </svg>
    </div>
  );
}
