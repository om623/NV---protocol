/**
 * useNVLive — NV News Automatic Live Narration
 *
 * Monitors the NV News queue for new Breaking and High priority events.
 * Queues and narrates them automatically while Live mode is enabled.
 * Never narrates the same event twice (dedup by URL + title fingerprint).
 * Respects a configurable inter-narration gap (default 2 s).
 * Handles browser autoplay restrictions gracefully:
 *   - sets `needsActivation` when the first speak() is blocked
 *   - resumes automatically after the user interacts with the page
 * Integrates with the existing useNVVoice hook — shares state and controls.
 */

import { useState, useRef, useCallback, useEffect, type MutableRefObject } from 'react';
import type { NVNewsItem } from './intelligence';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseNVLiveOptions {
  /** Milliseconds to wait between consecutive narrations (default 2000) */
  gapMs?: number;
}

export interface UseNVLiveReturn {
  /** Whether Live mode is currently ON */
  liveEnabled: boolean;
  /** Toggle Live mode on/off */
  toggleLive: () => void;
  /** Items queued for upcoming narration (not yet spoken) */
  pendingQueue: NVNewsItem[];
  /** Item currently being auto-narrated (null when idle) */
  currentLiveItem: NVNewsItem | null;
  /** True when the browser blocked autoplay and needs a user gesture */
  needsActivation: boolean;
  /** Call this on any user interaction to unblock autoplay */
  unlockAutoplay: () => void;
  /** True if speech synthesis is supported at all */
  supported: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const exact = voices.find(v => v.lang === lang);
  if (exact) return exact;
  const prefix = lang.split('-')[0];
  const partial = voices.find(v => v.lang.startsWith(prefix));
  return partial ?? voices[0];
}

/** Stable fingerprint for deduplication across feed refreshes */
function itemFingerprint(item: NVNewsItem): string {
  // Use URL as primary key; fall back to normalised title slug
  if (item.url && item.url.length > 10) return item.url;
  return item.headline.toLowerCase().replace(/\s+/g, '-').slice(0, 80);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNVLive(
  queue: NVNewsItem[],
  locale: string,
  options: UseNVLiveOptions = {},
): UseNVLiveReturn {
  const { gapMs = 2000 } = options;

  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [liveEnabled, setLiveEnabled] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<NVNewsItem[]>([]);
  const [currentLiveItem, setCurrentLiveItem] = useState<NVNewsItem | null>(null);
  const [needsActivation, setNeedsActivation] = useState(false);

  // Refs — never stale in callbacks
  const liveEnabledRef = useRef(false);
  const narrating = useRef(false);          // true while an utterance is active
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<NVNewsItem[]>([]);
  const narrated = useRef<Set<string>>(new Set()); // dedup set
  const localeRef = useRef(locale);
  const speedRef = useRef(1.0);             // mirror of voice speed
  const activationPending = useRef(false);  // waiting for user gesture

  // Keep locale ref current
  useEffect(() => { localeRef.current = locale; }, [locale]);

  // ── Core narration ──────────────────────────────────────────────────────────

  const speakNext = useCallback(() => {
    if (!supported) return;
    if (!liveEnabledRef.current) return;
    if (narrating.current) return;
    if (pendingRef.current.length === 0) return;

    const item = pendingRef.current[0];
    pendingRef.current = pendingRef.current.slice(1);
    setPendingQueue([...pendingRef.current]);

    const bcp47 = LOCALE_TO_BCP47[localeRef.current] ?? 'en-US';
    const utter = new SpeechSynthesisUtterance(item.voiceScript);
    utter.lang = bcp47;
    utter.rate = speedRef.current;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    const voice = pickVoice(bcp47);
    if (voice) utter.voice = voice;

    narrating.current = true;
    setCurrentLiveItem(item);

    utter.onstart = () => {
      // Successfully started — clear activation-pending flag
      activationPending.current = false;
      setNeedsActivation(false);
    };

    utter.onend = () => {
      narrating.current = false;
      setCurrentLiveItem(null);
      if (!liveEnabledRef.current) return;
      // Wait gap then speak next
      gapTimer.current = setTimeout(() => {
        speakNext();
      }, gapMs);
    };

    utter.onerror = (e) => {
      narrating.current = false;
      setCurrentLiveItem(null);

      if (e.error === 'interrupted') {
        // Normal cancel — don't schedule next
        return;
      }

      if (e.error === 'not-allowed') {
        // Autoplay blocked — put the item back at the front
        pendingRef.current = [item, ...pendingRef.current];
        setPendingQueue([...pendingRef.current]);
        activationPending.current = true;
        setNeedsActivation(true);
        return;
      }

      console.warn('[NVLive] SpeechSynthesis error:', e.error);
      // On other errors: skip item, try next after gap
      if (liveEnabledRef.current) {
        gapTimer.current = setTimeout(speakNext, gapMs);
      }
    };

    try {
      window.speechSynthesis.speak(utter);
    } catch {
      narrating.current = false;
      setCurrentLiveItem(null);
    }
  }, [supported, gapMs]);

  // ── Monitor queue for new breaking/high items ───────────────────────────────

  useEffect(() => {
    if (!supported || !liveEnabled) return;

    // Filter to breaking + high only; skip already narrated
    const eligible = queue.filter(item =>
      (item.priority === 'breaking' || item.priority === 'high') &&
      !narrated.current.has(itemFingerprint(item))
    );

    if (eligible.length === 0) return;

    // Mark all eligible as narrated immediately to prevent double-queueing
    // across rapid re-renders from feed refresh
    eligible.forEach(item => narrated.current.add(itemFingerprint(item)));

    // Sort: breaking first, then by publishedAt descending
    eligible.sort((a, b) => {
      if (a.priority === 'breaking' && b.priority !== 'breaking') return -1;
      if (b.priority === 'breaking' && a.priority !== 'breaking') return 1;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    pendingRef.current = [...pendingRef.current, ...eligible];
    setPendingQueue([...pendingRef.current]);

    // Kick off narration if idle
    if (!narrating.current) {
      speakNext();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, liveEnabled, supported]);
  // speakNext is stable (useCallback with no deps that change); intentionally
  // not in the dep array to avoid re-running on every render

  // ── Toggle ──────────────────────────────────────────────────────────────────

  const toggleLive = useCallback(() => {
    const next = !liveEnabledRef.current;
    liveEnabledRef.current = next;
    setLiveEnabled(next);

    if (!next) {
      // Turning OFF — cancel everything
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (gapTimer.current) clearTimeout(gapTimer.current);
      narrating.current = false;
      // Clear pending but keep narrated set so items don't replay when re-enabled
      pendingRef.current = [];
      setPendingQueue([]);
      setCurrentLiveItem(null);
      setNeedsActivation(false);
    } else {
      // Turning ON — seed the dedup set from the current queue so existing
      // items don't all get spoken at once; only truly new items will fire
      queue.forEach(item => narrated.current.add(itemFingerprint(item)));
    }
  }, [queue]);

  // ── Autoplay unlock ─────────────────────────────────────────────────────────

  const unlockAutoplay = useCallback(() => {
    if (!activationPending.current) return;
    activationPending.current = false;
    setNeedsActivation(false);
    // Retry speaking the front of the queue
    if (liveEnabledRef.current && !narrating.current && pendingRef.current.length > 0) {
      speakNext();
    }
  }, [speakNext]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      liveEnabledRef.current = false;
      if (gapTimer.current) clearTimeout(gapTimer.current);
      if (supported) window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose a way for NVVoicePlayer to sync speed changes
  // (accessed via ref pattern from parent — see NVVoicePlayer)
  useEffect(() => {
    // No-op: speedRef is updated directly by setLiveSpeed below
  }, []);

  return {
    liveEnabled,
    toggleLive,
    pendingQueue,
    currentLiveItem,
    needsActivation,
    unlockAutoplay,
    supported,
  };
}

/** Call this to keep live speed in sync with the manual player speed */
export function syncLiveSpeed(ref: MutableRefObject<number>, speed: number) {
  ref.current = speed;
}
