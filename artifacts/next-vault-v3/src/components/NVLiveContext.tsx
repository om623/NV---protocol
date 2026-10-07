/**
 * NVLiveContext — singleton Live narration state for the NV Protocol.
 *
 * Mounts ONCE at the NVIntelligence panel root and remains alive while
 * the panel is in the React tree, regardless of which sub-tab the user
 * is viewing. This means the speech engine is never destroyed on navigation.
 *
 * Usage:
 *   1. Wrap NVIntelligence content with <NVLiveProvider queue={queue} locale={locale}>
 *   2. Any child component calls useNVLiveContext() to access the shared state.
 */

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useNVLive, type UseNVLiveReturn } from '../lib/useNVLive';
import { useI18n } from '../i18n/context';
import type { NVNewsItem } from '../lib/intelligence';

// ─── Context ──────────────────────────────────────────────────────────────────

const NVLiveCtx = createContext<UseNVLiveReturn | null>(null);

export function useNVLiveContext(): UseNVLiveReturn {
  const ctx = useContext(NVLiveCtx);
  if (!ctx) throw new Error('useNVLiveContext must be used inside <NVLiveProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface NVLiveProviderProps {
  /** The current NV News queue (changes on every feed refresh) */
  queue: NVNewsItem[];
  children: ReactNode;
}

export function NVLiveProvider({ queue, children }: NVLiveProviderProps) {
  const { locale } = useI18n();

  // Single instance of the live hook — never recreated while this provider lives
  const live = useNVLive(locale);

  // When locale changes, the hook reads from localeRef internally so voice
  // language updates automatically. No re-mount needed.

  // Push queue updates into the live monitor whenever the feed refreshes
  const prevQueueRef = useRef<NVNewsItem[]>([]);

  useEffect(() => {
    // Only call updateQueue when the queue reference actually changes
    // (feed refresh produced a new array). Guard against identity-equal
    // rerenders so we don't flood the ingest logic.
    if (queue !== prevQueueRef.current) {
      prevQueueRef.current = queue;
      live.updateQueue(queue);
    }
  // live.updateQueue is stable (useCallback); queue changes on each fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  return <NVLiveCtx.Provider value={live}>{children}</NVLiveCtx.Provider>;
}
