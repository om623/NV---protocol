import type { Locale } from '../types';
import { ROWS_1 } from './rows1';
import { ROWS_2 } from './rows2';
import { ROWS_3 } from './rows3';
import { ROWS_4 } from './rows4';
import { ROWS_5 } from './rows5';

const ORDER: Locale[] = ['pt-BR', 'en', 'es', 'fr', 'zh', 'ja', 'ko', 'hi', 'ar'];

/** Global Radar strings for all nine locales, merged into the main dictionaries. */
export function buildRadarDicts(): Record<Locale, Record<string, string>> {
  const out = {} as Record<Locale, Record<string, string>>;
  for (const l of ORDER) out[l] = {};
  for (const row of [...ROWS_1, ...ROWS_2, ...ROWS_3, ...ROWS_4, ...ROWS_5]) {
    const [key, ...values] = row;
    ORDER.forEach((l, i) => { out[l][key] = values[i]; });
  }
  return out;
}

export const RADAR_KEYS: string[] = [...ROWS_1, ...ROWS_2, ...ROWS_3, ...ROWS_4, ...ROWS_5].map((r) => r[0]);
