import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { type Locale, detectLocale, LOCALES } from './types';
import { getDict } from './translations';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  localeBcp47: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem('nv-locale', l); } catch {}
    document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const dict = getDict(locale);
    let str = dict[key] ?? getDict('pt-BR')[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return str;
  }, [locale]);

  const localeBcp47 = LOCALES.find(l => l.code === locale)?.bcp47 ?? 'pt-BR';

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, localeBcp47 }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useFormat() {
  const { locale } = useI18n();
  const bcp = LOCALES.find(l => l.code === locale)?.bcp47 ?? 'pt-BR';

  const currency = useCallback((v: number, currency = 'USD', decimals = 2): string => {
    if (!Number.isFinite(v)) return '—';
    return new Intl.NumberFormat(bcp, { style: 'currency', currency, maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(v);
  }, [bcp]);

  const number = useCallback((v: number, decimals = 2): string => {
    if (!Number.isFinite(v)) return '—';
    return new Intl.NumberFormat(bcp, { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(v);
  }, [bcp]);

  const compact = useCallback((v: number): string => {
    if (!Number.isFinite(v)) return '—';
    return new Intl.NumberFormat(bcp, { notation: 'compact', maximumFractionDigits: 2 }).format(v);
  }, [bcp]);

  const percent = useCallback((v: number, withSign = false): string => {
    if (!Number.isFinite(v)) return '—';
    return `${withSign && v >= 0 ? '+' : ''}${new Intl.NumberFormat(bcp, { maximumFractionDigits: 2 }).format(v)}%`;
  }, [bcp]);

  const dateTime = useCallback((d: Date): string => {
    return new Intl.DateTimeFormat(bcp, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(d);
  }, [bcp]);

  return { currency, number, compact, percent, dateTime, bcp };
}
