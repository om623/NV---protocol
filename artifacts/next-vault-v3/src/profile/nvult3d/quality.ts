import { useSyncExternalStore } from 'react';
import { QUALITY_KEY, readQualityPref, writeQualityPref, type QualityPref } from './support';

// Tiny external store so every 3D view on the page (Identity hero, Lab stage, the quality picker) agrees on the preference.
const listeners = new Set<() => void>();

export function setQualityPref(p: QualityPref): void {
  writeQualityPref(p);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === QUALITY_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useQualityPref(): QualityPref {
  return useSyncExternalStore(subscribe, readQualityPref, () => 'auto' as QualityPref);
}
