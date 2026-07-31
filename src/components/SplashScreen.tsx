import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

interface SplashScreenProps {
  onEnter: () => void;
}

export function SplashScreen({ onEnter }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  // Generate particles once on mount
  const particles = useMemo<Particle[]>(() => {
    const arr: Particle[] = [];
    for (let i = 0; i < 60; i++) {
      arr.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 1.5,
        duration: Math.random() * 6 + 4,
        delay: Math.random() * 5,
        opacity: Math.random() * 0.5 + 0.15,
      });
    }
    return arr;
  }, []);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      handleEnter();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnter = () => {
    if (exiting) return;
    setExiting(true);
    // Wait for exit animation to complete
    setTimeout(() => {
      setVisible(false);
      onEnter();
    }, 800);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#05080f] overflow-hidden"
        >
          {/* ── Ambient background glow ──────────────────────────────── */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/4 rounded-full blur-[150px] pointer-events-none" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-[#a855f7]/4 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/3 right-1/4 w-[300px] h-[300px] bg-[#22c55e]/4 rounded-full blur-[100px] pointer-events-none" />

          {/* ── Particles ────────────────────────────────────────────── */}
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full bg-white pointer-events-none"
              style={{
                width: p.size,
                height: p.size,
                left: `${p.x}%`,
                top: `${p.y}%`,
                opacity: p.opacity,
              }}
              animate={{
                y: [0, -30, 0, 20, 0],
                x: [0, 15, -10, 5, 0],
                opacity: [p.opacity, p.opacity * 0.3, p.opacity, p.opacity * 0.5, p.opacity],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}

          {/* ── Content ──────────────────────────────────────────────── */}
          <div className="relative z-10 flex flex-col items-center px-6">

            {/* NV Protocol */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="flex flex-col items-center mb-8"
            >
              {/* Shield icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center relative mb-6"
              >
                <div className="absolute inset-0 rounded-2xl bg-primary/15 blur-lg opacity-40" />
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="rgb(0, 229, 188)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-[0.15em] text-foreground"
              >
                NV <span className="text-primary">PROTOCOL</span>
              </motion.h1>
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: '120px' }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent mt-4"
              />
            </motion.div>

            {/* Bible verse */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="text-sm sm:text-base text-muted-foreground/80 font-light tracking-wide text-center max-w-xl leading-relaxed mb-10 font-sans"
            >
              "And you shall know the truth, and the truth shall set you free."
              <br />
              <span className="text-[10px] sm:text-xs text-muted-foreground/50 font-mono tracking-widest">— John 8:32</span>
            </motion.p>

            {/* YHWH — neon effect purple & green */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 150, damping: 12, delay: 1.2 }}
              className="relative mb-12"
            >
              {/* Glow layers behind */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className="text-7xl sm:text-8xl md:text-9xl font-bold tracking-[0.3em] select-none"
                  style={{
                    color: 'transparent',
                    textShadow: `
                      0 0 7px rgba(168, 85, 247, 0.6),
                      0 0 15px rgba(168, 85, 247, 0.4),
                      0 0 30px rgba(168, 85, 247, 0.25),
                      0 0 60px rgba(34, 197, 94, 0.2),
                      0 0 90px rgba(34, 197, 94, 0.1)
                    `,
                    WebkitTextStroke: '1px rgba(255,255,255,0.1)',
                    animation: 'yhwhNeon 3s ease-in-out infinite alternate',
                  }}
                >
                  YHWH
                </span>
              </div>
              {/* Visible text */}
              <span
                className="text-7xl sm:text-8xl md:text-9xl font-bold tracking-[0.3em] relative"
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  textShadow: `
                    0 0 7px rgba(168, 85, 247, 0.8),
                    0 0 15px rgba(168, 85, 247, 0.6),
                    0 0 30px rgba(168, 85, 247, 0.4),
                    0 0 45px rgba(34, 197, 94, 0.3),
                    0 0 70px rgba(34, 197, 94, 0.2),
                    0 0 100px rgba(168, 85, 247, 0.1)
                  `,
                  animation: 'yhwhNeon 3s ease-in-out infinite alternate',
                }}
              >
                YHWH
              </span>
            </motion.div>

            {/* Enter button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.6 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleEnter}
              className="relative px-10 py-3.5 rounded-2xl text-base font-semibold tracking-widest uppercase cursor-pointer overflow-hidden group"
              style={{
                background: 'linear-gradient(135deg, rgba(0,229,188,0.15), rgba(168,85,247,0.1))',
                border: '1px solid rgba(0,229,188,0.25)',
                color: 'rgb(0, 229, 188)',
              }}
            >
              {/* Shimmer overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-[60%] -translate-x-[150%] group-hover:translate-x-[250%] transition-transform duration-[1.2s] ease-in-out skew-x-[-20deg]" />
              <span className="relative z-10 flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Entrar
              </span>
            </motion.button>

            {/* Bottom hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 2.2 }}
              className="absolute bottom-8 text-[9px] font-mono text-muted-foreground/20 tracking-widest"
            >
              Protocol V3
            </motion.p>
          </div>

          {/* ── Keyframes injected via style tag ──────────────────────── */}
          <style>{`
            @keyframes yhwhNeon {
              0% {
                text-shadow:
                  0 0 7px rgba(168, 85, 247, 0.8),
                  0 0 15px rgba(168, 85, 247, 0.6),
                  0 0 30px rgba(168, 85, 247, 0.4),
                  0 0 45px rgba(34, 197, 94, 0.3),
                  0 0 70px rgba(34, 197, 94, 0.2),
                  0 0 100px rgba(168, 85, 247, 0.1);
              }
              50% {
                text-shadow:
                  0 0 7px rgba(34, 197, 94, 0.8),
                  0 0 15px rgba(34, 197, 94, 0.6),
                  0 0 30px rgba(34, 197, 94, 0.4),
                  0 0 45px rgba(168, 85, 247, 0.3),
                  0 0 70px rgba(168, 85, 247, 0.2),
                  0 0 100px rgba(34, 197, 94, 0.1);
              }
              100% {
                text-shadow:
                  0 0 7px rgba(168, 85, 247, 0.8),
                  0 0 20px rgba(168, 85, 247, 0.5),
                  0 0 40px rgba(168, 85, 247, 0.3),
                  0 0 50px rgba(34, 197, 94, 0.25),
                  0 0 80px rgba(34, 197, 94, 0.15),
                  0 0 120px rgba(168, 85, 247, 0.08);
              }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

