import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Pause, VolumeX, Repeat, Play, Radio } from 'lucide-react';
import { useI18n } from '../i18n';
import { useSpeech } from '../hooks/use-speech';
import { generateContextualMessages, type DashboardContext } from '../lib/news';

interface DigitalPresenterProps {
  context: DashboardContext;
}

export function DigitalPresenter({ context }: DigitalPresenterProps) {
  const { t, locale, localeBcp47 } = useI18n();
  const speech = useSpeech();
  const [messages, setMessages] = useState<string[]>([]);
  const [msgIdx, setMsgIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Regenerate contextual messages when context or locale changes
  useEffect(() => {
    const msgs = generateContextualMessages(context, locale);
    setMessages(msgs);
    setMsgIdx(0);
  }, [context.fearGreedIndex, context.totalTvl, context.btcDominance, context.activeNetworkName, locale]);

  // Auto-rotate through messages every 12s
  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (messages.length <= 1) return;
    timerRef.current = window.setInterval(() => {
      setMsgIdx(prev => (prev + 1) % messages.length);
    }, 12000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [messages.length]);

  const currentMessage = messages[msgIdx] ?? t('presenter.noEvents');

  const handleSpeak = useCallback(() => {
    speech.speak(currentMessage, { lang: localeBcp47 });
  }, [currentMessage, localeBcp47, speech]);

  const handlePauseResume = useCallback(() => {
    if (speech.paused) speech.resume();
    else speech.pause();
  }, [speech]);

  const handleRepeat = useCallback(() => {
    speech.repeat(localeBcp47);
  }, [localeBcp47, speech]);

  const handleNext = useCallback(() => {
    setMsgIdx(prev => (prev + 1) % Math.max(1, messages.length));
  }, [messages.length]);

  const statusColor = context.isLiveData ? 'text-emerald-400' : 'text-amber-400';
  const statusDot = context.isLiveData ? 'bg-emerald-400' : 'bg-amber-400';

  const voiceControls = useMemo(() => {
    if (!speech.supported) return null;
    return (
      <div className="flex items-center gap-1">
        {!speech.speaking && !speech.paused && (
          <button onClick={handleSpeak}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            title={t('presenter.speak')}>
            <Volume2 size={13} />
          </button>
        )}
        {speech.speaking && !speech.paused && (
          <button onClick={handlePauseResume}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors cursor-pointer"
            title={t('presenter.pause')}>
            <Pause size={13} />
          </button>
        )}
        {speech.paused && (
          <button onClick={handlePauseResume}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-emerald-400 transition-colors cursor-pointer"
            title={t('presenter.resume')}>
            <Play size={13} />
          </button>
        )}
        <button onClick={() => speech.toggleMute()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${speech.muted ? 'text-red-400 hover:bg-red-400/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
          title={t('presenter.mute')}>
          {speech.muted ? <VolumeX size={13} /> : <Volume2 size={13} className="opacity-30" />}
        </button>
        <button onClick={handleRepeat}
          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          title={t('presenter.repeat')}>
          <Repeat size={13} />
        </button>
      </div>
    );
  }, [speech, handleSpeak, handlePauseResume, handleRepeat, t]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.4 }}
      className="w-full rounded-2xl border border-primary/15 bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3),0_0_20px_rgba(0,229,188,0.04)] transition-all duration-300"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Silhouette / Avatar */}
            <div className="relative w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-xl bg-primary/8 blur-sm animate-pulse" />
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary relative z-10" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="7" r="4" />
                <path d="M5.5 21c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-mono font-semibold text-foreground tracking-wide">{t('presenter.title')}</span>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot} animate-pulse`} />
                <span className="text-[8px] font-mono text-muted-foreground/50">{context.isLiveData ? t('presenter.liveData') : t('presenter.contextual')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {voiceControls}
            <button onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <Radio size={13} className={expanded ? 'text-primary' : ''} />
            </button>
          </div>
        </div>

        {/* Message */}
        <div className="min-h-[44px] flex items-start gap-2">
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIdx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.3 }}
              className="text-[12px] leading-relaxed text-foreground/80 font-sans"
            >
              {currentMessage}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Expanded: all messages */}
        <AnimatePresence>
          {expanded && messages.length > 1 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/30 flex flex-col gap-1.5">
                {messages.map((msg, i) => (
                  <button key={i} onClick={() => { setMsgIdx(i); setExpanded(false); }}
                    className={`text-left text-[11px] font-sans leading-relaxed px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      i === msgIdx ? 'bg-primary/8 text-primary' : 'text-muted-foreground/60 hover:bg-secondary hover:text-foreground'
                    }`}>
                    {msg}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom bar: pagination + voice status */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/20">
          <div className="flex items-center gap-1">
            {messages.length > 1 && messages.map((_, i) => (
              <button key={i} onClick={() => setMsgIdx(i)}
                className={`h-1 rounded-full transition-all cursor-pointer ${i === msgIdx ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2 text-[8px] font-mono text-muted-foreground/40">
            {speech.speaking && <span className="flex items-center gap-1 text-primary"><Volume2 size={9} className="animate-pulse" /> {t('presenter.speak')}</span>}
            {speech.muted && <span className="flex items-center gap-1 text-red-400/60"><VolumeX size={9} /> {t('presenter.mute')}</span>}
            {!speech.supported && <span className="text-muted-foreground/30">{t('presenter.voiceUnavailable')}</span>}
            <button onClick={handleNext} className="text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer">
              {msgIdx + 1}/{messages.length}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
