import type { Locale } from '../types';
import { ROWS_1 } from './rows1';
import { ROWS_2 } from './rows2';
import { ROWS_3 } from './rows3';

const ORDER: Locale[] = ['pt-BR', 'en', 'es', 'fr', 'zh', 'ja', 'ko', 'hi', 'ar'];

/** Profile / Nvult strings for all nine locales, merged into the main dictionaries. */
export function buildProfileDicts(): Record<Locale, Record<string, string>> {
  const out = {} as Record<Locale, Record<string, string>>;
  for (const l of ORDER) out[l] = {};
  for (const row of [...ROWS_1, ...ROWS_2, ...ROWS_3]) {
    const [key, ...values] = row;
    ORDER.forEach((l, i) => { out[l][key] = values[i]; });
  }
  return out;
}

export const PROFILE_KEYS: string[] = [...ROWS_1, ...ROWS_2, ...ROWS_3].map((r) => r[0]);
