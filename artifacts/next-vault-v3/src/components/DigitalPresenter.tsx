import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Pause, VolumeX, Repeat, Play, Radio, ChevronRight, Clock, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n';
import { getAsset } from '../lib/marketData';
import { getIndexState, fetchAllIndices } from '../lib/indices';
import { fetchEquityQuotes, getLocaleTickerList, formatEquityPrice, type EquityQuote } from '../lib/equities';
import { useSpeech } from '../hooks/use-speech';
import {
  generateEditorialEvents,
  colorClasses,
  type DashboardContext,
  type EditorialEvent,
} from '../lib/news';

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
  const [marketQuotes, setMarketQuotes] = useState<EquityQuote[]>([]);
  const [indexSnapshot, setIndexSnapshot] = useState(() => getIndexState().quotes);
  const [btcSnapshot, setBtcSnapshot] = useState(() => getAsset('BTC'));
  const [welcomeText, setWelcomeText] = useState('Welcome to NV Protocol. Your next move starts here.');
  const welcomeDoneRef = useRef(false);
  const lastShownIdRef = useRef<string>('');
  const timerRef = useRef<number | null>(null);

  const welcomeByLocale: Record<string, string> = {
    'pt-BR': 'Boas-vindas ao NV Protocol. Sua próxima evolução começa agora.',
    en: 'Welcome to NV Protocol. Your next evolution starts now.',
    es: 'Te damos la bienvenida a NV Protocol. Tu próxima evolución comienza ahora.',
    fr: 'Bienvenue sur NV Protocol. Votre prochaine évolution commence maintenant.',
    zh: '欢迎来到 NV Protocol。你的下一次进化现在开始。',
    ja: 'NV Protocolへようこそ。次の進化が今、始まります。',
    ko: 'NV Protocol에 오신 것을 환영합니다. 다음 진화가 지금 시작됩니다.',
    hi: 'NV Protocol में आपका स्वागत है। आपका अगला विकास अब शुरू होता है।',
    ar: 'مرحبًا بك في NV Protocol. يبدأ تطورك التالي الآن.',
  };

  // Welcome in the user's selected language. Browsers may require a prior tap
  // before allowing speech; the visible greeting always remains available.
  useEffect(() => {
    const greeting = welcomeByLocale[locale] ?? welcomeByLocale.en;
    setWelcomeText(greeting);
    if (!speech.supported || welcomeDoneRef.current) return;
    welcomeDoneRef.current = true;
    try {
      speech.speak(greeting, { lang: localeBcp47, rate: 0.92, pitch: 1.02, volume: 0.8 });
    } catch {
      // Voice controls remain available when autoplay is blocked by the browser.
    }
  }, [locale, localeBcp47, speech.supported]);

  // Refresh real BTC, local-market index and localized equity symbols.
  useEffect(() => {
    let cancelled = false;
    const loadMarketBrief = async () => {
      try {
        const [quotes, indices] = await Promise.all([
          fetchEquityQuotes(locale),
          fetchAllIndices(),
        ]);
        if (cancelled) return;
        setMarketQuotes(quotes);
        setIndexSnapshot(indices);
        setBtcSnapshot(getAsset('BTC'));
      } catch {
        if (!cancelled) setBtcSnapshot(getAsset('BTC'));
      }
    };
    void loadMarketBrief();
    const id = window.setInterval(() => { void loadMarketBrief(); }, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [locale]);

  const marketMeta = getLocaleTickerList(locale);
  const localIndexSymbol: Record<string, string> = {
    'pt-BR': 'IBOV', en: 'SPX', es: 'IBEX', fr: 'CAC', zh: 'SHCOMP',
    ja: 'N225', ko: 'KS11', hi: 'NSEI', ar: 'TASI',
  };
  const localIndex = indexSnapshot.get(localIndexSymbol[locale] ?? 'SPX');
  const marketCurrency: Record<string, string> = {
    'pt-BR': 'BRL', en: 'USD', es: 'EUR', fr: 'EUR', zh: 'CNY',
    ja: 'JPY', ko: 'KRW', hi: 'INR', ar: 'SAR',
  };
  const formatMoney = (value: number, currency: string) => new Intl.NumberFormat(locale === 'pt-BR' ? 'pt-BR' : locale, {
    style: 'currency', currency, maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);

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
    if (events.length <= 1) return;
    timerRef.current = window.setInterval(() => {
      setEvtIdx(prev => {
        const next = (prev + 1) % events.length;
        lastShownIdRef.current = events[next]?.id ?? '';
        return next;
      });
    }, ROTATION_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [events.length]);

  const currentEvent = events[evtIdx];

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
      const next = (prev + 1) % Math.max(1, events.length);
      lastShownIdRef.current = events[next]?.id ?? '';
      return next;
    });
  }, [events.length]);

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

        {/* Personalized welcome + real market briefing */}
        <div className="mb-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/8 via-[#071316] to-cyan-500/5 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary"><Sparkles size={14} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-primary">NV PRESENTER</div>
              <div className="text-xs font-semibold text-foreground">{welcomeText}</div>
            </div>
            <span className="rounded-full border border-primary/20 px-2 py-0.5 text-[8px] font-mono text-primary/70">9 LANG</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-white/5 bg-black/20 p-2">
              <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">BITCOIN · BTC/USD</div>
              {btcSnapshot?.isLive
                ? <div className="mt-1 flex items-baseline gap-2"><span className="text-sm font-bold text-foreground">{formatMoney(btcSnapshot.price, 'USD')}</span><span className={btcSnapshot.change24h >= 0 ? 'text-[10px] text-emerald-400' : 'text-[10px] text-red-400'}>{btcSnapshot.change24h >= 0 ? '+' : ''}{btcSnapshot.change24h.toFixed(2)}%</span></div>
                : <div className="mt-1 text-[10px] text-amber-300/70">{locale === 'pt-BR' ? 'Aguardando cotação verificada…' : 'Waiting for a verified quote…'}</div>}
            </div>
            <div className="rounded-lg border border-white/5 bg-black/20 p-2">
              <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">{marketMeta.marketLabel} · {localIndex?.symbol ?? (localIndexSymbol[locale] ?? 'SPX')}</div>
              {localIndex
                ? <div className="mt-1 flex flex-wrap items-baseline gap-2"><span className="text-sm font-bold text-foreground">{formatMoney(localIndex.price, localIndex.currency || marketCurrency[locale] || 'USD')}</span><span className={localIndex.changePercent !== null && localIndex.changePercent >= 0 ? 'text-[10px] text-emerald-400' : 'text-[10px] text-red-400'}>{localIndex.changePercent === null ? '—' : `${localIndex.changePercent >= 0 ? '+' : ''}${localIndex.changePercent.toFixed(2)}%`}</span></div>
                : <div className="mt-1 text-[10px] text-amber-300/70">{locale === 'pt-BR' ? 'Índice aguardando dados da bolsa…' : 'Waiting for verified index data…'}</div>}
            </div>
          </div>
          <div className="mt-2 border-t border-white/5 pt-2">
            <div className="mb-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50">{locale === 'pt-BR' ? 'AÇÕES · MERCADOS GLOBAIS' : locale === 'es' ? 'ACCIONES · MERCADOS GLOBALES' : locale === 'fr' ? 'ACTIONS · MARCHÉS MONDIAUX' : locale === 'ar' ? 'الأسهم · الأسواق العالمية' : 'EQUITIES · GLOBAL MARKETS'}</div>
            {marketQuotes.length > 0
              ? <div className="flex flex-wrap gap-x-3 gap-y-1">{marketQuotes.slice(0, 8).map(q => <span key={q.symbol} className="inline-flex items-center gap-1 text-[9px] font-mono"><strong className="text-foreground/80">{q.symbol}</strong><span className={q.change !== null && q.change >= 0 ? 'text-emerald-400' : q.change !== null ? 'text-red-400' : 'text-muted-foreground/40'}>{q.price === null ? '—' : formatEquityPrice(q.price, q.currency)} {q.change === null ? '' : `${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)}%`}</span></span>)}</div>
              : <div className="text-[10px] text-muted-foreground/50">{locale === 'pt-BR' ? 'Carregando cotações verificadas; valores indisponíveis não são inventados.' : 'Loading verified quotes; unavailable values are never fabricated.'}</div>}
            <div className="mt-1 text-[8px] text-muted-foreground/35">{locale === 'pt-BR' ? 'Cotações sujeitas a atraso. Informativo, não é recomendação financeira.' : 'Quotes may be delayed. Informational only, not financial advice.'}</div>
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
          {expanded && events.length > 1 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/30 flex flex-col gap-1.5">
                {events.map((evt, i) => {
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
            {events.length > 1 && (
              <div className="flex items-center gap-1">
                {events.map((_, i) => (
                  <button key={i} onClick={() => { setEvtIdx(i); lastShownIdRef.current = events[i]?.id ?? ''; }}
                    className={`h-1 rounded-full transition-all cursor-pointer ${i === evtIdx ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40'}`}
                    aria-label={`Event ${i + 1}`} />
                ))}
              </div>
            )}
            {/* Next button */}
            {events.length > 1 && (
              <button onClick={handleNext}
                className="text-[8px] font-mono text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer flex items-center gap-0.5"
                title={t('presenter.next')} aria-label={t('presenter.next')}>
                {evtIdx + 1}/{events.length}
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
