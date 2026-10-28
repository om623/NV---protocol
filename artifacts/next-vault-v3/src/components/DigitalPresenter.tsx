import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Pause, VolumeX, Repeat, Play, Radio, ChevronRight, Clock } from 'lucide-react';
import { useI18n } from '../i18n';
import { useSpeech } from '../hooks/use-speech';
import {
  generateEditorialEvents,
  colorClasses,
  type DashboardContext,
  type EditorialEvent,
} from '../lib/news';
import { fetchAllNews } from '../lib/intelligence';
import { fetchGlobalEquityHighlights } from '../lib/equities';

interface DigitalPresenterProps {
  context: DashboardContext;
}

const ROTATION_MS = 10000;

export function DigitalPresenter({ context }: DigitalPresenterProps) {
  const { t, locale, localeBcp47 } = useI18n();
  const speech = useSpeech();
  const [events, setEvents] = useState<EditorialEvent[]>([]);
  const [evtIdx, setEvtIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [elapsedMin, setElapsedMin] = useState(0);
  const lastShownIdRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);
  const [marketBriefEvents, setMarketBriefEvents] = useState<EditorialEvent[]>([]);

  // Regenerate events when context or locale changes
  useEffect(() => {
    const evts = generateEditorialEvents(context, locale);
    setEvents(evts);

    // Avoid showing the same event immediately after regeneration
    if (evts.length > 0) {
      const startIdx = evts.findIndex(e => e.id !== lastShownIdRef.current);
      setEvtIdx(startIdx >= 0 ? startIdx : 0);
      lastShownIdRef.current = evts[startIdx >= 0 ? startIdx : 0]?.id ?? '';
    }
    setLastUpdate(Date.now());
  }, [
    context.fearGreedIndex,
    context.fearGreedLabel,
    context.totalTvl,
    context.btcDominance,
    context.activeNetworkName,
    context.isWalletConnected,
    context.networkOnline,
    context.recentSwapActivity,
    locale,
  ]);


  // Real global market brief: one live stock from every supported language/market,
  // official Fed target range, plus real IPO/dividend/rate-cut headlines.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const now = Date.now();
      const extra: EditorialEvent[] = [];
      try {
        const [quotes, news, fedRes] = await Promise.all([
          fetchGlobalEquityHighlights(),
          fetchAllNews(),
          fetch('/api/fed-brief').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        for (const q of quotes) {
          if (q.price == null || q.change == null) continue;
          extra.push({id:'equity_'+q.locale,category:'Global Equities',title:`${q.marketLabel} · ${q.symbol}`,description:`${q.name}: ${q.price.toLocaleString(localeBcp47,{maximumFractionDigits:2})} ${q.currency}; ${q.change>=0?'+':''}${q.change.toFixed(2)}% no último pregão.`,priority:'market_movement',color:q.change>=0?'emerald':'orange',timestamp:now});
        }
        if (fedRes?.targetLow != null && fedRes?.targetHigh != null) {
          extra.push({id:'fed_rate',category:'Federal Reserve',title:'Fed Funds Target Range',description:`Federal Reserve: faixa-alvo atual de ${fedRes.targetLow}% a ${fedRes.targetHigh}%. Fonte oficial do Fed.`,priority:'recent_change',color:'cyan',timestamp:now});
        }
        const relevant = news.filter(n => /\b(ipo|initial public offering|dividend|dividendo|rate cut|interest rate cut|corte de juros|federal reserve|\bfed\b|fomc)\b/i.test(`${n.title} ${n.summary}`)).slice(0,5);
        for (const n of relevant) {
          const text=`${n.title}. ${n.summary||''}`.trim();
          const cut=/rate cut|interest rate cut|corte de juros/i.test(text);
          const ipo=/\bipo\b|initial public offering/i.test(text);
          const div=/dividend|dividendo/i.test(text);
          extra.push({id:'brief_'+n.id,category:cut?'Interest Rates':ipo?'IPO':div?'Dividends':'Federal Reserve',title:n.title,description:`${n.source}: ${n.summary||n.title}`,priority:'recent_change',color:cut?'violet':ipo?'cyan':div?'emerald':'neutral',timestamp:n.publishedMs||now});
        }
      } catch { /* Keep existing presenter events; never invent fallback market data. */ }
      if (alive) setMarketBriefEvents(extra);
    };
    load();
    const iv=window.setInterval(load,120000);
    return()=>{alive=false;window.clearInterval(iv)};
  }, [localeBcp47]);

  // Update "Atualizado há X min"
  useEffect(() => {
    const update = () => {
      const mins = Math.floor((Date.now() - lastUpdate) / 60000);
      setElapsedMin(mins);
    };
    update();
    const id = window.setInterval(update, 30000);
    return () => window.clearInterval(id);
  }, [lastUpdate]);

  // Auto-rotate through events
  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (combinedEvents.length <= 1) return;
    timerRef.current = window.setInterval(() => {
      setEvtIdx(prev => {
        const next = (prev + 1) % combinedEvents.length;
        lastShownIdRef.current = combinedEvents[next]?.id ?? '';
        return next;
      });
    }, ROTATION_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [combinedEvents.length]);

  const combinedEvents = useMemo(() => [...marketBriefEvents, ...events], [marketBriefEvents, events]);
  const currentEvent = combinedEvents[evtIdx % Math.max(1, combinedEvents.length)];

  const handleSpeak = useCallback(() => {
    if (!currentEvent) return;
    const text = `${currentEvent.title}. ${currentEvent.description}`;
    speech.speak(text, { lang: localeBcp47 });
  }, [currentEvent, localeBcp47, speech]);

  const handlePauseResume = useCallback(() => {
    if (speech.paused) speech.resume();
    else speech.pause();
  }, [speech]);

  const handleRepeat = useCallback(() => {
    speech.repeat(localeBcp47);
  }, [localeBcp47, speech]);

  const handleNext = useCallback(() => {
    setEvtIdx(prev => {
      const next = (prev + 1) % Math.max(1, combinedEvents.length);
      lastShownIdRef.current = combinedEvents[next]?.id ?? '';
      return next;
    });
  }, [combinedEvents.length]);

  const colors = useMemo(() => {
    return currentEvent ? colorClasses(currentEvent.color) : colorClasses('neutral');
  }, [currentEvent]);

  const liveColor = context.isLiveData ? 'text-emerald-400' : 'text-amber-400';
  const liveDot = context.isLiveData ? 'bg-emerald-400' : 'bg-amber-400';

  const updatedLabel = useMemo(() => {
    if (elapsedMin === 0) return t('presenter.updatedNow');
    return t('presenter.updatedAgo', { mins: elapsedMin });
  }, [elapsedMin, t]);

  const voiceControls = useMemo(() => {
    if (!speech.supported) return null;
    return (
      <div className="flex items-center gap-0.5">
        {!speech.speaking && !speech.paused && (
          <button onClick={handleSpeak}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            title={t('presenter.speak')} aria-label={t('presenter.speak')}>
            <Volume2 size={13} />
          </button>
        )}
        {speech.speaking && !speech.paused && (
          <button onClick={handlePauseResume}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors cursor-pointer"
            title={t('presenter.pause')} aria-label={t('presenter.pause')}>
            <Pause size={13} />
          </button>
        )}
        {speech.paused && (
          <button onClick={handlePauseResume}
            className="p-1.5 rounded-lg hover:bg-primary/10 text-emerald-400 transition-colors cursor-pointer"
            title={t('presenter.resume')} aria-label={t('presenter.resume')}>
            <Play size={13} />
          </button>
        )}
        <button onClick={() => speech.toggleMute()}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${speech.muted ? 'text-red-400 hover:bg-red-400/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
          title={t('presenter.mute')} aria-label={t('presenter.mute')}>
          {speech.muted ? <VolumeX size={13} /> : <Volume2 size={13} className="opacity-30" />}
        </button>
        <button onClick={handleRepeat}
          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          title={t('presenter.repeat')} aria-label={t('presenter.repeat')}>
          <Repeat size={13} />
        </button>
      </div>
    );
  }, [speech, handleSpeak, handlePauseResume, handleRepeat, t]);

  if (!currentEvent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.4 }}
      className={`w-full rounded-2xl border ${colors.border} bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3),0_0_20px_rgba(0,229,188,0.04)] transition-all duration-300 overflow-hidden`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-xl bg-primary/8 blur-sm animate-pulse" />
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-primary relative z-10" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="7" r="4" />
                <path d="M5.5 21c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-mono font-semibold text-foreground tracking-wide">{t('presenter.title')}</span>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${liveDot} animate-pulse`} />
                <span className={`text-[8px] font-mono uppercase tracking-widest ${liveColor}`}>{t('presenter.live')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {voiceControls}
            <button onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={t('presenter.allEvents')} aria-label={t('presenter.allEvents')}>
              <Radio size={13} className={expanded ? 'text-primary' : ''} />
            </button>
          </div>
        </div>

        {/* Event content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentEvent.id + evtIdx}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.3 }}
          >
            {/* Category badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                {currentEvent.category}
              </span>
              {speech.speaking && (
                <span className="flex items-center gap-1 text-[9px] font-mono text-primary">
                  <Volume2 size={9} className="animate-pulse" />
                  {t('presenter.speaking')}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className={`text-[13px] font-semibold leading-tight mb-1.5 ${colors.text}`}>
              {currentEvent.title}
            </h3>

            {/* Description */}
            <p className="text-[11.5px] leading-relaxed text-foreground/70 font-sans line-clamp-3">
              {currentEvent.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Expanded: all events */}
        <AnimatePresence>
          {expanded && combinedEvents.length > 1 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/30 flex flex-col gap-1.5">
                {combinedEvents.map((evt, i) => {
                  const ec = colorClasses(evt.color);
                  return (
                    <button key={evt.id} onClick={() => { setEvtIdx(i); setExpanded(false); lastShownIdRef.current = evt.id; }}
                      className={`text-left flex items-start gap-2 text-[11px] font-sans leading-relaxed px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        i === evtIdx ? `${ec.bg} ${ec.text}` : 'text-muted-foreground/60 hover:bg-secondary hover:text-foreground'
                      }`}>
                      <ChevronRight size={11} className="shrink-0 mt-0.5 opacity-50" />
                      <span className="truncate">{evt.title}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom bar: timestamp + pagination */}
        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/20">
          <div className="flex items-center gap-1 text-[8px] font-mono text-muted-foreground/40">
            <Clock size={9} />
            <span>{updatedLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Pagination dots */}
            {combinedEvents.length > 1 && (
              <div className="flex items-center gap-1">
                {combinedEvents.map((_, i) => (
                  <button key={i} onClick={() => { setEvtIdx(i); lastShownIdRef.current = combinedEvents[i]?.id ?? ''; }}
                    className={`h-1 rounded-full transition-all cursor-pointer ${i === evtIdx ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40'}`}
                    aria-label={`Event ${i + 1}`} />
                ))}
              </div>
            )}
            {/* Next button */}
            {combinedEvents.length > 1 && (
              <button onClick={handleNext}
                className="text-[8px] font-mono text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer flex items-center gap-0.5"
                title={t('presenter.next')} aria-label={t('presenter.next')}>
                {evtIdx + 1}/{combinedEvents.length}
                <ChevronRight size={10} />
              </button>
            )}
            {!speech.supported && (
              <span className="text-[8px] font-mono text-muted-foreground/25">{t('presenter.voiceUnavailable')}</span>
            )}
            {speech.muted && (
              <span className="flex items-center gap-0.5 text-[8px] font-mono text-red-400/50">
                <VolumeX size={8} /> {t('presenter.mute')}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
