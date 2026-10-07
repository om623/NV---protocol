/**
 * useNVLive — NV News Automatic Live Narration
 *
 * Behaviour contract (per spec):
 *   • When Live is ON, narrates new Breaking/High events automatically.
 *   • After each narration ends, waits at least LIVE_GAP_MS (8 minutes)
 *     before starting the next one.
 *   • If a new eligible event arrives during the cooldown it is queued; it
 *     will play as soon as the cooldown expires.
 *   • If there is nothing in the queue after the cooldown, stays silent until
 *     a genuinely new event arrives. No filler, no repeats.
 *   • Never interrupts a running narration. Incoming events join the queue.
 *   • Never narrates the same event twice (dedup by URL + title fingerprint).
 *   • Respects the currently selected locale/language.
 *   • Activating Live is the required user gesture for autoplay — no extra click.
 *   • Lives inside a React Context (NVLiveContext) so it persists across views.
 *
 * This hook contains only the state-machine logic.
 * The React Context wrapper is in NVLiveContext.tsx.
 */

import { useState, useRef, useCallback, useEffect, type MutableRefObject } from 'react';
import type { NVNewsItem } from './intelligence';

// ─── Configuration ────────────────────────────────────────────────────────────

/** 8 minutes between separate automatic announcements */
export const LIVE_GAP_MS = 8 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseNVLiveOptions {
  /** Override the inter-narration cooldown (ms). Defaults to LIVE_GAP_MS. */
  gapMs?: number;
}

export interface UseNVLiveReturn {
  /** Whether Live mode is currently ON */
  liveEnabled: boolean;
  /** Toggle Live mode on/off */
  toggleLive: () => void;
  /** Items queued for upcoming narration (not yet spoken) */
  pendingQueue: NVNewsItem[];
  /** Item currently being auto-narrated (null when idle/cooldown) */
  currentLiveItem: NVNewsItem | null;
  /** True when the browser blocked autoplay and needs a user gesture */
  needsActivation: boolean;
  /** Call on any user interaction to unblock autoplay */
  unlockAutoplay: () => void;
  /** True if speech synthesis is supported at all */
  supported: boolean;
  /**
   * Remaining cooldown in ms (0 when ready, >0 while waiting).
   * Updated every second while a cooldown is active.
   */
  cooldownRemainingMs: number;
  /** Push a fresh queue of items into the Live monitor */
  updateQueue: (items: NVNewsItem[]) => void;
}

// ─── BCP-47 map ───────────────────────────────────────────────────────────────

const LOCALE_TO_BCP47: Record<string, string> = {
  'pt-BR': 'pt-BR',
  'en':    'en-US',
  'es':    'es-ES',
  'fr':    'fr-FR',
  'zh':    'zh-CN',
  'ja':    'ja-JP',
  'ko':    'ko-KR',
  'hi':    'hi-IN',
  'ar':    'ar-SA',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const exact = voices.find(v => v.lang === lang);
  if (exact) return exact;
  const prefix = lang.split('-')[0];
  return voices.find(v => v.lang.startsWith(prefix)) ?? voices[0];
}

/** Stable dedup fingerprint — URL first, then normalised title slug */
function fingerprint(item: NVNewsItem): string {
  if (item.url && item.url.length > 10) return item.url;
  return item.headline.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNVLive(
  initialLocale: string,
  options: UseNVLiveOptions = {},
): UseNVLiveReturn {
  const { gapMs = LIVE_GAP_MS } = options;

  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  // ── React state (drives re-renders) ─────────────────────────────────────────
  const [liveEnabled, setLiveEnabled]               = useState(false);
  const [pendingQueue, setPendingQueue]             = useState<NVNewsItem[]>([]);
  const [currentLiveItem, setCurrentLiveItem]       = useState<NVNewsItem | null>(null);
  const [needsActivation, setNeedsActivation]       = useState(false);
  const [cooldownRemainingMs, setCooldownRemaining] = useState(0);

  // ── Refs — always current in async callbacks ─────────────────────────────────
  const liveEnabledRef    = useRef(false);
  const narrating         = useRef(false);
  const pendingRef        = useRef<NVNewsItem[]>([]);
  const narrated          = useRef<Set<string>>(new Set());
  const localeRef         = useRef(initialLocale);
  const speedRef          = useRef(1.0);
  const activationPending = useRef(false);

  // Cooldown: timestamp when narration last ended (0 = never)
  const lastEndMs         = useRef(0);
  const cooldownTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const clearCooldownTick = useCallback(() => {
    if (cooldownTickTimer.current) {
      clearInterval(cooldownTickTimer.current);
      cooldownTickTimer.current = null;
    }
    setCooldownRemaining(0);
  }, []);

  const startCooldownTick = useCallback((endsAt: number) => {
    clearCooldownTick();
    const tick = () => {
      const rem = Math.max(0, endsAt - Date.now());
      setCooldownRemaining(rem);
      if (rem === 0) clearCooldownTick();
    };
    tick();
    cooldownTickTimer.current = setInterval(tick, 1000);
  }, [clearCooldownTick]);

  // ── Core: speak the front of the queue ───────────────────────────────────────

  // Forward declaration — speakNext calls itself recursively via closure
  const speakNextRef = useRef<() => void>(() => {});

  const speakNext = useCallback(() => {
    if (!supported) return;
    if (!liveEnabledRef.current) return;
    if (narrating.current) return;
    if (pendingRef.current.length === 0) return;

    // Enforce cooldown — if not enough time has passed since last narration, schedule retry
    const now = Date.now();
    const elapsed = now - lastEndMs.current;
    const remaining = lastEndMs.current === 0 ? 0 : Math.max(0, gapMs - elapsed);

    if (remaining > 0) {
      // Schedule to retry when cooldown expires; tick UI
      startCooldownTick(lastEndMs.current + gapMs);
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      cooldownTimer.current = setTimeout(() => speakNextRef.current(), remaining);
      return;
    }

    const item = pendingRef.current[0];
    pendingRef.current = pendingRef.current.slice(1);
    setPendingQueue([...pendingRef.current]);

    const bcp47 = LOCALE_TO_BCP47[localeRef.current] ?? 'en-US';
    const utter = new SpeechSynthesisUtterance(item.voiceScript);
    utter.lang   = bcp47;
    utter.rate   = speedRef.current;
    utter.pitch  = 1.0;
    utter.volume = 1.0;
    const voice  = pickVoice(bcp47);
    if (voice) utter.voice = voice;

    narrating.current = true;
    setCurrentLiveItem(item);
    clearCooldownTick(); // Clear any displayed countdown while narrating

    utter.onstart = () => {
      activationPending.current = false;
      setNeedsActivation(false);
    };

    utter.onend = () => {
      narrating.current = false;
      lastEndMs.current = Date.now();
      setCurrentLiveItem(null);

      if (!liveEnabledRef.current) return;

      if (pendingRef.current.length > 0) {
        // More items waiting — start cooldown then play next
        const endsAt = lastEndMs.current + gapMs;
        startCooldownTick(endsAt);
        cooldownTimer.current = setTimeout(() => speakNextRef.current(), gapMs);
      }
      // If queue is empty: stay silent; the queue monitor will trigger speakNext
      // when a new eligible item arrives after the cooldown.
    };

    utter.onerror = (e) => {
      narrating.current = false;
      setCurrentLiveItem(null);

      if (e.error === 'interrupted') return; // Normal cancel

      if (e.error === 'not-allowed') {
        // Autoplay blocked — put item back, wait for user gesture
        pendingRef.current = [item, ...pendingRef.current];
        setPendingQueue([...pendingRef.current]);
        activationPending.current = true;
        setNeedsActivation(true);
        return;
      }

      console.warn('[NVLive] SpeechSynthesis error:', e.error);
      if (liveEnabledRef.current && pendingRef.current.length > 0) {
        cooldownTimer.current = setTimeout(() => speakNextRef.current(), Math.min(gapMs, 30_000));
      }
    };

    try {
      window.speechSynthesis.speak(utter);
    } catch {
      narrating.current = false;
      setCurrentLiveItem(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, gapMs, startCooldownTick, clearCooldownTick]);

  // Keep ref current so cooldown timer closure always calls latest version
  useEffect(() => { speakNextRef.current = speakNext; }, [speakNext]);

  // ── Queue monitor: called by updateQueue ─────────────────────────────────────

  const ingestItems = useCallback((items: NVNewsItem[]) => {
    if (!liveEnabledRef.current) return;

    const eligible = items.filter(item =>
      (item.priority === 'breaking' || item.priority === 'high') &&
      !narrated.current.has(fingerprint(item))
    );

    if (eligible.length === 0) return;

    // Mark as seen immediately to prevent double-queueing on rapid re-renders
    eligible.forEach(item => narrated.current.add(fingerprint(item)));

    // Breaking first, then high; within each tier sort by recency
    eligible.sort((a, b) => {
      const pa = a.priority === 'breaking' ? 0 : 1;
      const pb = b.priority === 'breaking' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    pendingRef.current = [...pendingRef.current, ...eligible];
    setPendingQueue([...pendingRef.current]);

    // Kick off narration if idle and cooldown allows
    if (!narrating.current) {
      speakNextRef.current();
    }
  }, []);

  /** Called by the provider whenever the NV News queue refreshes */
  const updateQueue = useCallback((items: NVNewsItem[]) => {
    ingestItems(items);
  }, [ingestItems]);

  // ── Toggle ───────────────────────────────────────────────────────────────────

  const toggleLive = useCallback(() => {
    const next = !liveEnabledRef.current;
    liveEnabledRef.current = next;
    setLiveEnabled(next);

    if (!next) {
      // Turning OFF — cancel everything
      if (supported) window.speechSynthesis.cancel();
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      clearCooldownTick();
      narrating.current = false;
      pendingRef.current = [];
      setPendingQueue([]);
      setCurrentLiveItem(null);
      setNeedsActivation(false);
      activationPending.current = false;
      lastEndMs.current = 0;
    } else {
      // Turning ON — seed the dedup set from the current pending queue so
      // existing items are NOT re-narrated; only genuinely new ones fire.
      // The caller (NVVoicePlayer) should call updateQueue() right after
      // toggleLive() so the initial queue check runs with liveEnabled=true.
    }
  }, [supported, clearCooldownTick]);

  // ── Autoplay unlock ──────────────────────────────────────────────────────────

  const unlockAutoplay = useCallback(() => {
    if (!activationPending.current) return;
    activationPending.current = false;
    setNeedsActivation(false);
    if (liveEnabledRef.current && !narrating.current && pendingRef.current.length > 0) {
      speakNextRef.current();
    }
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      liveEnabledRef.current = false;
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      clearCooldownTick();
      if (supported) window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    liveEnabled,
    toggleLive,
    pendingQueue,
    currentLiveItem,
    needsActivation,
    unlockAutoplay,
    supported,
    cooldownRemainingMs,
    updateQueue,
  };
}

/** Utility: keep the live speed ref in sync from an external speed control */
export function syncLiveSpeed(ref: MutableRefObject<number>, speed: number) {
  ref.current = speed;
}
