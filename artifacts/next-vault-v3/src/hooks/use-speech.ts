import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeakOptions {
  lang: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface SpeechState {
  speaking: boolean;
  paused: boolean;
  muted: boolean;
  supported: boolean;
  voicesAvailable: boolean;
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [supported, setSupported] = useState(false);
  const [voicesAvailable, setVoicesAvailable] = useState(false);
  const lastTextRef = useRef('');
  const lastLangRef = useRef('');

  useEffect(() => {
    const s = typeof window !== 'undefined' && 'speechSynthesis' in window;
    setSupported(s);
    if (!s) return;

    const checkVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setVoicesAvailable(voices.length > 0);
    };
    checkVoices();
    window.speechSynthesis.addEventListener('voiceschanged', checkVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', checkVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string, opts: SpeakOptions) => {
    if (!supported || !text || muted) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang;
    u.rate = opts.rate ?? 0.95;
    u.pitch = opts.pitch ?? 1.0;
    u.volume = opts.volume ?? 0.7;

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = opts.lang.split('-')[0];
    const match = voices.find(v => v.lang === opts.lang)
      ?? voices.find(v => v.lang.startsWith(langPrefix));
    if (match) u.voice = match;

    u.onstart = () => { setSpeaking(true); setPaused(false); };
    u.onend = () => { setSpeaking(false); setPaused(false); };
    u.onerror = () => { setSpeaking(false); setPaused(false); };

    lastTextRef.current = text;
    lastLangRef.current = opts.lang;
    window.speechSynthesis.speak(u);
  }, [supported, muted]);

  const pause = useCallback(() => {
    if (!supported || !speaking) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, [supported, speaking]);

  const resume = useCallback(() => {
    if (!supported || !paused) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported, paused]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      if (!prev) window.speechSynthesis.cancel();
      return !prev;
    });
  }, []);

  const repeat = useCallback((lang: string) => {
    if (!lastTextRef.current) return;
    speak(lastTextRef.current, { lang });
  }, [speak]);

  return {
    speak, pause, resume, stop, repeat, toggleMute,
    speaking, paused, muted, supported, voicesAvailable,
  };
}
