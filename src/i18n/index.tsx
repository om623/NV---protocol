import React, { createContext, useContext, useMemo, useState } from 'react';
import { ptBR, type PtBR } from './pt-BR';
import { en } from './en';

export type Locale = 'pt-BR' | 'en';
export type Dictionary = PtBR | typeof en;

const DICTIONARIES: Record<Locale, Dictionary> = {
  'pt-BR': ptBR,
  en,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolvePath(obj: unknown, path: string): string {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj) as string;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('pt-BR');
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key: string) => {
        const dict = DICTIONARIES[locale];
        const str = resolvePath(dict, key);
        return typeof str === 'string' ? str : key;
      },
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within <I18nProvider>');
  return ctx;
}

