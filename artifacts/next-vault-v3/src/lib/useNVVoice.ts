/**
 * useNVVoice — NV News voice layer
 *
 * Wraps browser-native SpeechSynthesis. No external API, no fake keys.
 * Locale → BCP-47 voice hint mapping for all 9 supported NV locales.
 * Exposes: play, pause, resume, stop, setSpeed, isPlaying, isPaused,
 *          currentIndex, supported.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { NVNewsItem } from './intelligence';

// ─── Locale → BCP-47 language tag hint ───────────────────────────────────────
// Used to pick the best matching voice from the browser's voice list.
// speechSynthesis.getVoices() is async in some browsers; we do a best-effort
// match at play time.
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
  // Exact BCP-47 match
  const exact = voices.find(v => v.lang === lang);
  if (exact) return exact;
  // Language prefix match (e.g. zh-CN → zh)
  const prefix = lang.split('-')[0];
  const partial = voices.find(v => v.lang.startsWith(prefix));
  if (partial) return partial;
  // Last resort: first available
  return voices[0];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type VoiceState = 'idle' | 'playing' | 'paused' | 'finished' | 'unsupported';

export interface UseNVVoiceReturn {
  /** Whether SpeechSynthesis is available in this browser */
  supported: boolean;
  state: VoiceState;
  currentIndex: number;
  /** 0.5 – 2.0 */
  speed: number;
  setSpeed: (s: number) => void;
  play: (queue: NVNewsItem[], startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipTo: (index: number) => void;
}

export function useNVVoice(locale: string): UseNVVoiceReturn {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [state, setState] = useState<VoiceState>(supported ? 'idle' : 'unsupported');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [speed, setSpeedState] = useState(1.0);

  // We keep the queue in a ref so callbacks always see latest value
  const queueRef = useRef<NVNewsItem[]>([]);
  const indexRef = useRef(-1);
  const speedRef = useRef(1.0);
  const stateRef = useRef<VoiceState>(supported ? 'idle' : 'unsupported');

  // Keep ref in sync
  const updateState = useCallback((s: VoiceState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const updateIndex = useCallback((i: number) => {
    indexRef.current = i;
    setCurrentIndex(i);
  }, []);

  // Voices may load asynchronously (Chrome)
  useEffect(() => {
    if (!supported) return;
    const handleVoicesChanged = () => {}; // just trigger a re-render / refetch next play
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
  }, [supported]);

  // Stop and clean up when component unmounts or locale changes
  useEffect(() => {
    return () => {
      if (supported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [supported]);

  const speakItem = useCallback((item: NVNewsItem, idx: number) => {
    if (!supported) return;
    window.speechSynthesis.cancel();

    const bcp47 = LOCALE_TO_BCP47[locale] ?? 'en-US';
    const utter = new SpeechSynthesisUtterance(item.voiceScript);
    utter.lang = bcp47;
    utter.rate = speedRef.current;
    utter.pitch = 1.0;
    utter.volume = 1.0;

    const voice = pickVoice(bcp47);
    if (voice) utter.voice = voice;

    updateIndex(idx);
    updateState('playing');

    utter.onend = () => {
      const next = idx + 1;
      if (next < queueRef.current.length && stateRef.current === 'playing') {
        speakItem(queueRef.current[next], next);
      } else {
        updateState('finished');
        updateIndex(-1);
      }
    };

    utter.onerror = (e) => {
      // 'interrupted' is normal when stop() is called; ignore it
      if (e.error === 'interrupted') return;
      console.warn('[NVVoice] SpeechSynthesis error:', e.error);
      updateState('idle');
      updateIndex(-1);
    };

    window.speechSynthesis.speak(utter);
  }, [locale, supported, updateIndex, updateState]);

  const play = useCallback((queue: NVNewsItem[], startIndex = 0) => {
    if (!supported || !queue.length) return;
    queueRef.current = queue;
    window.speechSynthesis.cancel();
    speakItem(queue[startIndex] ?? queue[0], startIndex);
  }, [supported, speakItem]);

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    updateState('paused');
  }, [supported, updateState]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    updateState('playing');
  }, [supported, updateState]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    updateState('idle');
    updateIndex(-1);
  }, [supported, updateState, updateIndex]);

  const skipTo = useCallback((index: number) => {
    if (!supported || !queueRef.current.length) return;
    if (index < 0 || index >= queueRef.current.length) return;
    speakItem(queueRef.current[index], index);
  }, [supported, speakItem]);

  const setSpeed = useCallback((s: number) => {
    const clamped = Math.min(2.0, Math.max(0.5, s));
    speedRef.current = clamped;
    setSpeedState(clamped);
    // If currently playing, restart current item at new speed
    if (stateRef.current === 'playing' && indexRef.current >= 0 && queueRef.current.length) {
      speakItem(queueRef.current[indexRef.current], indexRef.current);
    }
  }, [speakItem]);

  return { supported, state, currentIndex, speed, setSpeed, play, pause, resume, stop, skipTo };
}
