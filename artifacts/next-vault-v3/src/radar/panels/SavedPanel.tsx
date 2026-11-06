import { Clock, Globe2, Search, Star, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import { getCompany } from '../data/companies';
import { countryName } from '../data/countries';
import { clearHistory, type HistoryEntry, type RadarUserData } from '../store';
import { SectionTitle, cardCls } from '../ui';

interface Props {
  user: RadarUserData;
  onOpenCompany: (id: string) => void;
  onOpenCountry: (a2: string) => void;
  onSearch: (q: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function SavedPanel({ user, onOpenCompany, onOpenCountry, onSearch, onToggleFavorite }: Props) {
  const { t, localeBcp47 } = useI18n();

  const open = (h: HistoryEntry) => {
    if (h.kind === 'company') onOpenCompany(h.value);
    else if (h.kind === 'country') onOpenCountry(h.value);
    else onSearch(h.value);
  };
  const labelOf = (h: HistoryEntry): string =>
    h.kind === 'company' ? getCompany(h.value)?.name ?? h.value : h.kind === 'country' ? countryName(h.value, localeBcp47) : h.value;

  return (
    <div className="flex flex-col gap-5">
      <section>
        <SectionTitle>{t('radar.saved.favorites')}</SectionTitle>
        {user.favorites.length === 0 ? (
          <p className="text-xs text-violet-200/55">{t('radar.saved.noFavorites')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {user.favorites.map((id) => {
              const c = getCompany(id);
              if (!c) return null;
              return (
                <li key={id} className={`${cardCls} flex items-center gap-1`}>
                  <button onClick={() => onOpenCompany(id)} className="min-w-0 flex-1 px-3 py-2.5 text-start cursor-pointer">
                    <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                    <span className="block truncate text-[11px] text-violet-200/55">{c.city}, {countryName(c.country, localeBcp47)}</span>
                  </button>
                  <button onClick={() => onToggleFavorite(id)} aria-label={t('radar.favorite')} className="p-2.5 text-amber-300 cursor-pointer"><Star size={14} fill="currentColor" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle aside={user.history.length > 0 ? (
          <button onClick={clearHistory} className="inline-flex items-center gap-1 text-[11px] text-violet-200 hover:text-white cursor-pointer"><Trash2 size={11} /> {t('radar.saved.clear')}</button>
        ) : undefined}>
          {t('radar.saved.history')}
        </SectionTitle>
        {user.history.length === 0 ? (
          <p className="text-xs text-violet-200/55">{t('radar.saved.noHistory')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {user.history.map((h) => (
              <li key={`${h.kind}:${h.value}`}>
                <button onClick={() => open(h)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-foreground/90 hover:bg-violet-500/10 cursor-pointer">
                  {h.kind === 'search' ? <Search size={13} className="text-violet-300/60" /> : h.kind === 'country' ? <Globe2 size={13} className="text-violet-300/60" /> : <Clock size={13} className="text-violet-300/60" />}
                  <span className="min-w-0 flex-1 truncate">{labelOf(h)}</span>
                  <span className="text-[10px] uppercase tracking-wider text-violet-300/45">{t(`radar.saved.kind.${h.kind}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-violet-200/40">{t('radar.saved.deviceNote')}</p>
      </section>
    </div>
  );
}
