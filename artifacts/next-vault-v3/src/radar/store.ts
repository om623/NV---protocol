// Radar user data: favourites, comparison list and query history.
// Stored on this device (localStorage) behind a small repository interface so a
// remote database can replace it later without touching the UI.

import { useSyncExternalStore } from 'react';

export type HistoryKind = 'search' | 'company' | 'country';

export interface HistoryEntry {
  kind: HistoryKind;
  value: string;
  at: number;
}

export interface RadarUserData {
  favorites: string[];
  compare: string[];
  history: HistoryEntry[];
}

export interface RadarRepository {
  load(): RadarUserData;
  save(data: RadarUserData): void;
}

const KEY = 'nv.radar.user.v1';
export const MAX_COMPARE = 4;
const MAX_HISTORY = 40;

const empty = (): RadarUserData => ({ favorites: [], compare: [], history: [] });

export const localRepository: RadarRepository = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const p = JSON.parse(raw) as Partial<RadarUserData>;
      return {
        favorites: Array.isArray(p.favorites) ? p.favorites.filter((x): x is string => typeof x === 'string') : [],
        compare: Array.isArray(p.compare) ? p.compare.filter((x): x is string => typeof x === 'string').slice(0, MAX_COMPARE) : [],
        history: Array.isArray(p.history) ? p.history.filter((h) => h && typeof h.value === 'string').slice(0, MAX_HISTORY) : [],
      };
    } catch {
      return empty();
    }
  },
  save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // storage full or unavailable: state stays in memory for this session
    }
  },
};

let repo: RadarRepository = localRepository;
let state: RadarUserData = repo.load();
const listeners = new Set<() => void>();

function commit(next: RadarUserData) {
  state = next;
  repo.save(next);
  listeners.forEach((l) => l());
}

export function useRadarUser(): RadarUserData {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state,
  );
}

export function toggleFavorite(id: string) {
  commit({ ...state, favorites: state.favorites.includes(id) ? state.favorites.filter((x) => x !== id) : [id, ...state.favorites] });
}

/** Returns false when the list is full and the id was not added. */
export function toggleCompare(id: string): boolean {
  if (state.compare.includes(id)) {
    commit({ ...state, compare: state.compare.filter((x) => x !== id) });
    return true;
  }
  if (state.compare.length >= MAX_COMPARE) return false;
  commit({ ...state, compare: [...state.compare, id] });
  return true;
}

export function clearCompare() {
  commit({ ...state, compare: [] });
}

export function recordHistory(kind: HistoryKind, value: string) {
  const v = value.trim();
  if (!v) return;
  const rest = state.history.filter((h) => !(h.kind === kind && h.value === v));
  commit({ ...state, history: [{ kind, value: v, at: Date.now() }, ...rest].slice(0, MAX_HISTORY) });
}

export function clearHistory() {
  commit({ ...state, history: [] });
}

/** Swap the persistence backend (for example a database-backed repository). */
export function setRadarRepository(next: RadarRepository) {
  repo = next;
  state = repo.load();
  listeners.forEach((l) => l());
}
