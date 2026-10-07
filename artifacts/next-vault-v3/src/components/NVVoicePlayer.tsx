/**
 * NVVoicePlayer — NV News voice playback UI
 *
 * Renders play / pause / stop controls and a speed selector.
 * Highlights the currently narrated item in the news queue.
 * No avatar, no generated face — voice only.
 * Gracefully degrades when SpeechSynthesis is unavailable.
 */

import { useMemo } from 'react';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  SkipForward,
  ChevronRight,
  Mic,
  MicOff,
  Zap,
  Clock,
  Radio,
  AlertCircle,
  Loader2,
  Timer,
} from 'lucide-react';
import type { NVNewsItem } from '../lib/intelligence';
import { COUNTRY_FLAG, CATEGORY_CONFIG, formatRelativeTime } from '../lib/intelligence';
import { useNVVoice } from '../lib/useNVVoice';
import { useNVLiveContext } from './NVLiveContext';
import { useI18n } from '../i18n/context';

interface Props {
  queue: NVNewsItem[];
}

const SPEED_STEPS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

function speedLabel(s: number) {
  return s === 1.0 ? '1×' : `${s}×`;
}

export default function NVVoicePlayer({ queue }: Props) {
  const { t, locale } = useI18n();
  const { supported, state, currentIndex, speed, setSpeed, play, pause, resume, stop, skipTo } =
    useNVVoice(locale);

  // Live mode — reads from the singleton context (persists across navigation)
  const {
    liveEnabled,
    toggleLive,
    pendingQueue,
    currentLiveItem,
    needsActivation,
    unlockAutoplay,
    cooldownRemainingMs,
    updateQueue,
  } = useNVLiveContext();

  const isPlaying = state === 'playing';
  const isPaused = state === 'paused';
  const isActive = isPlaying || isPaused;

  // When Live is turned ON: stop manual player to avoid conflicts,
  // then immediately seed the queue with current items.
  const handleToggleLive = () => {
    if (!liveEnabled && isActive) stop();
    toggleLive();
    // If turning ON, pass current queue now (provider also does this on refresh,
    // but the first activation needs an immediate seed).
    if (!liveEnabled) {
      // toggleLive flips to ON — seed immediately
      setTimeout(() => updateQueue(queue), 0);
    }
  };

  const displayQueue = useMemo(() => queue, [queue]);

  if (!supported) {
    return (
      <div className="rounded-xl border border-border/30 bg-card/60 px-4 py-3 flex items-center gap-2.5">
        <MicOff size={14} className="text-muted-foreground/40 shrink-0" />
        <p className="text-xs text-muted-foreground/50 leading-snug">
          {t('voice.unsupported')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur overflow-hidden">

      {/* ── Live mode status bar ── */}
      {liveEnabled && (
        <div
          className={`flex items-center gap-2 px-4 py-2 border-b ${
            currentLiveItem
              ? 'bg-red-500/8 border-red-500/25'
              : 'bg-primary/5 border-primary/20'
          }`}
          onClick={needsActivation ? unlockAutoplay : undefined}
          role={needsActivation ? 'button' : undefined}
          style={needsActivation ? { cursor: 'pointer' } : undefined}
        >
          {needsActivation ? (
            <>
              <AlertCircle size={12} className="text-amber-400 shrink-0 animate-pulse" />
              <span className="text-[10px] font-mono text-amber-400/80 flex-1">
                {t('live.tapToUnlock')}
              </span>
            </>
          ) : currentLiveItem ? (
            <>
              {/* Soundbars */}
              <div className="flex gap-0.5 items-end h-3.5 shrink-0">
                <span className="w-0.5 bg-red-400 rounded-full animate-[soundbar_0.6s_ease-in-out_infinite]" style={{ height: '55%' }} />
                <span className="w-0.5 bg-red-400 rounded-full animate-[soundbar_0.6s_ease-in-out_0.2s_infinite]" style={{ height: '100%' }} />
                <span className="w-0.5 bg-red-400 rounded-full animate-[soundbar_0.6s_ease-in-out_0.1s_infinite]" style={{ height: '70%' }} />
              </div>
              <span className="text-[10px] font-mono text-red-400/80 shrink-0">{t('live.narrating')}</span>
              <span className="text-[10px] font-mono text-foreground/60 flex-1 truncate ml-1">
                {currentLiveItem.headline}
              </span>
              {pendingQueue.length > 0 && (
                <span className="text-[9px] font-mono bg-red-500/15 text-red-400 border border-red-500/25 rounded px-1.5 py-0.5 shrink-0">
                  +{pendingQueue.length} {t('live.pending')}
                </span>
              )}
            </>
          ) : cooldownRemainingMs > 0 ? (
            <>
              <Timer size={11} className="text-muted-foreground/40 shrink-0" />
              <span className="text-[10px] font-mono text-muted-foreground/50 flex-1">
                {t('live.cooldown')} {Math.ceil(cooldownRemainingMs / 60000)}m
              </span>
              {pendingQueue.length > 0 && (
                <span className="text-[9px] font-mono bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 shrink-0">
                  {pendingQueue.length} {t('live.pending')}
                </span>
              )}
            </>
          ) : (
            <>
              <Loader2 size={11} className="text-primary/50 shrink-0 animate-spin" />
              <span className="text-[10px] font-mono text-primary/60 flex-1">{t('live.monitoring')}</span>
              {pendingQueue.length > 0 && (
                <span className="text-[9px] font-mono bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 shrink-0">
                  {pendingQueue.length} {t('live.pending')}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Transport bar ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-card/60">
        {/* Live toggle */}
        <button
          onClick={handleToggleLive}
          className={`flex items-center gap-1 h-6 px-2 rounded-md text-[9px] font-mono font-bold transition-all shrink-0 ${
            liveEnabled
              ? 'bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25'
              : 'bg-muted/30 border border-border/30 text-muted-foreground/50 hover:text-muted-foreground/80 hover:border-border/60'
          }`}
          title={liveEnabled ? t('live.turnOff') : t('live.turnOn')}
        >
          <Radio size={9} className={liveEnabled ? 'animate-pulse' : ''} />
          {liveEnabled ? t('live.on') : t('live.off')}
        </button>

        {/* Mic indicator */}
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
            isPlaying
              ? 'bg-amber-500/20 border border-amber-500/40 animate-pulse'
              : 'bg-muted/30 border border-border/30'
          }`}
        >
          {isPlaying ? (
            <Mic size={12} className="text-amber-400" />
          ) : (
            <Volume2 size={12} className="text-muted-foreground/50" />
          )}
        </div>

        {/* Current item headline */}
        <div className="flex-1 min-w-0">
          {isActive && currentIndex >= 0 && displayQueue[currentIndex] ? (
            <p className="text-[10px] font-mono text-foreground/70 truncate">
              {displayQueue[currentIndex].headline}
            </p>
          ) : (
            <p className="text-[10px] font-mono text-muted-foreground/40">
              {state === 'finished' ? t('voice.finished') : t('voice.ready')}
            </p>
          )}
        </div>

        {/* Controls — disabled when Live is active to avoid conflict */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Play / Pause */}
          {!liveEnabled && (
            isPlaying ? (
              <button
                onClick={pause}
                className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center hover:bg-amber-500/20 transition-colors"
                title={t('voice.pause')}
              >
                <Pause size={12} className="text-amber-400" />
              </button>
            ) : isPaused ? (
              <button
                onClick={resume}
                className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center hover:bg-amber-500/20 transition-colors"
                title={t('voice.resume')}
              >
                <Play size={12} className="text-amber-400" />
              </button>
            ) : (
              <button
                onClick={() => play(displayQueue, 0)}
                disabled={!displayQueue.length}
                className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center hover:bg-primary/20 transition-colors disabled:opacity-30"
                title={t('voice.playAll')}
              >
                <Play size={12} className="text-primary" />
              </button>
            )
          )}

          {/* Skip — only for manual mode */}
          {!liveEnabled && isActive && (
            <button
              onClick={() => {
                const next = currentIndex + 1;
                if (next < displayQueue.length) skipTo(next);
                else stop();
              }}
              className="w-7 h-7 rounded-lg bg-muted/30 border border-border/30 flex items-center justify-center hover:bg-muted/60 transition-colors"
              title={t('voice.skip')}
            >
              <SkipForward size={12} className="text-muted-foreground/60" />
            </button>
          )}

          {/* Stop — always available when active */}
          {!liveEnabled && isActive && (
            <button
              onClick={stop}
              className="w-7 h-7 rounded-lg bg-muted/30 border border-border/30 flex items-center justify-center hover:bg-red-500/10 transition-colors"
              title={t('voice.stop')}
            >
              <Square size={12} className="text-muted-foreground/60" />
            </button>
          )}
        </div>

        {/* Speed selector — affects both manual and live */}
        <div className="flex items-center gap-0.5 ml-1 shrink-0">
          {SPEED_STEPS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`h-5 px-1.5 rounded text-[9px] font-mono transition-colors ${
                speed === s
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground/50 hover:text-muted-foreground/80'
              }`}
            >
              {speedLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Queue list ── */}
      {displayQueue.length === 0 ? (
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground/40 italic">{t('intel.nvNewsReady')}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {displayQueue.map((item, i) => {
            const catCfg = CATEGORY_CONFIG[item.category];
            const active = isActive && currentIndex === i;
            return (
              <button
                key={`${item.url}-${i}`}
                onClick={() => play(displayQueue, i)}
                className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors group ${
                  active
                    ? 'bg-amber-500/8 border-l-2 border-l-amber-400'
                    : 'hover:bg-muted/20 border-l-2 border-l-transparent'
                }`}
              >
                {/* Index / playing indicator */}
                <div className="w-4 shrink-0 flex items-center justify-center mt-0.5">
                  {active ? (
                    <div className="flex gap-0.5 items-end h-3.5">
                      <span className="w-0.5 bg-amber-400 rounded-full animate-[soundbar_0.6s_ease-in-out_infinite]" style={{ height: '55%' }} />
                      <span className="w-0.5 bg-amber-400 rounded-full animate-[soundbar_0.6s_ease-in-out_0.2s_infinite]" style={{ height: '100%' }} />
                      <span className="w-0.5 bg-amber-400 rounded-full animate-[soundbar_0.6s_ease-in-out_0.1s_infinite]" style={{ height: '70%' }} />
                    </div>
                  ) : (
                    <span
                      className={`text-[9px] font-mono ${
                        item.priority === 'breaking' ? 'text-red-400' : 'text-orange-400/60'
                      }`}
                    >
                      {i + 1}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-[9px] font-mono text-muted-foreground/50">
                      {COUNTRY_FLAG[item.country]} {item.country}
                    </span>
                    <span className={`text-[8px] font-mono px-1 py-0.5 rounded ${catCfg?.bg ?? 'bg-muted/30'} ${catCfg?.color ?? 'text-muted-foreground'}`}>
                      {item.category}
                    </span>
                    {/* Editorial tier chip */}
                    {item.editorialTier === 2 && (
                      <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-primary/10 text-primary/70 border border-primary/20">
                        {t('focus.local')}
                      </span>
                    )}
                    {item.editorialTier === 1 && (
                      <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-primary/5 text-primary/50 border border-primary/10">
                        {t('focus.region')}
                      </span>
                    )}
                    {(item.editorialTier === 0 || item.editorialTier === undefined) && (
                      <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-muted/20 text-muted-foreground/40 border border-border/20">
                        {t('focus.global')}
                      </span>
                    )}
                    {item.priority === 'breaking' && (
                      <span className="flex items-center gap-0.5 text-[8px] font-mono text-red-400 bg-red-500/8 border border-red-500/20 px-1 py-0.5 rounded">
                        <Zap size={7} />
                        {t('intel.breaking')}
                      </span>
                    )}
                    <span className="ml-auto text-[9px] font-mono text-muted-foreground/35 flex items-center gap-0.5">
                      <Clock size={8} />
                      {formatRelativeTime(new Date(item.publishedAt).getTime() || Date.now(), locale)}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] leading-snug transition-colors ${
                      active
                        ? 'text-foreground/90 font-medium'
                        : 'text-foreground/70 group-hover:text-foreground/85'
                    }`}
                  >
                    {item.headline}
                  </p>
                  <p className="mt-0.5 text-[9px] font-mono text-muted-foreground/35">{item.source}</p>
                </div>

                {/* Tap hint */}
                {!active && (
                  <ChevronRight size={12} className="text-muted-foreground/20 shrink-0 mt-1 group-hover:text-muted-foreground/50 transition-colors" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Live pending queue (shown only when live is on and there are pending items) ── */}
      {liveEnabled && pendingQueue.length > 0 && (
        <div className="border-t border-border/20 px-4 py-2.5 bg-primary/3">
          <p className="text-[9px] font-mono text-muted-foreground/40 mb-1.5 uppercase tracking-wider">
            {t('live.upNext')} ({pendingQueue.length})
          </p>
          <div className="space-y-1">
            {pendingQueue.slice(0, 3).map((item, i) => (
              <div key={`pending-${item.url}-${i}`} className="flex items-center gap-2">
                <span className={`text-[8px] font-mono shrink-0 ${item.priority === 'breaking' ? 'text-red-400' : 'text-orange-400/60'}`}>
                  {item.priority === 'breaking' ? '⚡' : '▸'}
                </span>
                <p className="text-[10px] text-muted-foreground/60 truncate">{item.headline}</p>
              </div>
            ))}
            {pendingQueue.length > 3 && (
              <p className="text-[9px] font-mono text-muted-foreground/30">
                +{pendingQueue.length - 3} {t('live.more')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Soundbar keyframe */}
      <style>{`
        @keyframes soundbar {
          0%, 100% { transform: scaleY(0.4); }
          50%       { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
