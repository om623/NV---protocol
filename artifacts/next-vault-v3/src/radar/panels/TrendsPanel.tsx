import { useEffect, useMemo, useState } from 'react';
import { Newspaper, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import type { CompanySeed, LoadState, NewsItem, SectorId } from '../types';
import { COMPANIES } from '../data/companies';
import { SECTORS, SECTOR_NEWS_QUERY } from '../data/sectors';
import { fetchQuote } from '../adapters/quote';
import { fetchNews } from '../adapters/gdelt';
import { SourceError } from '../adapters/http';
import { formatDateTime, formatPercent } from '../format';
import { Chip, LoadBlock, SectionTitle, Spinner, btnCls, cardCls } from '../ui';

type ThemeId = 'ma' | 'expansion' | 'regulation';
const THEMES: { id: ThemeId; terms: string }[] = [
  { id: 'ma', terms: '(merger OR acquisition OR takeover OR acquires)' },
  { id: 'expansion', terms: '(expansion OR "new plant" OR "new factory" OR invests OR investment)' },
  { id: 'regulation', terms: '(regulation OR regulator OR "new law" OR ban OR antitrust)' },
];
const SIZE_RANK = { mega: 0, large: 1, growth: 2 } as const;

interface MomentumRow { company: CompanySeed; ret1m: number | null; ret3m: number | null }
interface Momentum { rows: MomentumRow[]; failed: number }

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** "a b c" -> (a OR b OR c); quoted phrases are kept whole. */
export function toGdeltOr(query: string): string {
  const tokens = query.match(/"[^"]+"|\S+/g) ?? [];
  return tokens.length <= 1 ? query : `(${tokens.join(' OR ')})`;
}

export function TrendsPanel({ onOpenCompany }: { onOpenCompany: (id: string) => void }) {
  const { t, localeBcp47 } = useI18n();
  const [sector, setSector] = useState<SectorId>('ai');
  const [mom, setMom] = useState<LoadState<Momentum>>({ state: 'idle' });
  const [themes, setThemes] = useState<Partial<Record<ThemeId, LoadState<NewsItem[]>>>>({});
  const [tick, setTick] = useState(0);

  const candidates = useMemo(
    () => COMPANIES.filter((c) => c.sector === sector && c.yahoo).sort((a, b) => SIZE_RANK[a.size] - SIZE_RANK[b.size] || a.name.localeCompare(b.name)).slice(0, 10),
    [sector],
  );

  useEffect(() => {
    setThemes({});
    if (candidates.length === 0) { setMom({ state: 'ready', data: { rows: [], failed: 0 } }); return; }
    let cancelled = false;
    setMom({ state: 'loading' });
    (async () => {
      const rows: MomentumRow[] = [];
      let failed = 0;
      for (let i = 0; i < candidates.length; i += 3) {
        const chunk = candidates.slice(i, i + 3);
        const res = await Promise.allSettled(chunk.map((c) => fetchQuote(c.yahoo as string)));
        res.forEach((r, j) => {
          if (r.status === 'fulfilled') rows.push({ company: chunk[j], ret1m: r.value.ret1m, ret3m: r.value.ret3m });
          else failed++;
        });
        if (cancelled) return;
      }
      setMom({ state: 'ready', data: { rows, failed } });
    })().catch((e: unknown) => { if (!cancelled) setMom({ state: 'error', message: (e as Error).message }); });
    return () => { cancelled = true; };
  }, [candidates, tick]);

  const loadHeadlines = () => {
    const sectorExpr = toGdeltOr(SECTOR_NEWS_QUERY[sector]);
    const init: Partial<Record<ThemeId, LoadState<NewsItem[]>>> = {};
    THEMES.forEach((th) => { init[th.id] = { state: 'loading' }; });
    setThemes(init);
    THEMES.forEach((th) => {
      fetchNews(`${th.terms} ${sectorExpr}`, 5, '1month')
        .then((items) => setThemes((p) => ({ ...p, [th.id]: { state: 'ready', data: items } })))
        .catch((e: unknown) => setThemes((p) => ({ ...p, [th.id]: { state: 'error', message: (e as Error).message, code: e instanceof SourceError ? e.code : undefined } })));
    });
  };

  const sel = 'rounded-lg border border-violet-500/25 bg-violet-950/40 px-2 py-2 text-sm text-foreground focus:outline-none focus:border-violet-400/70 w-full';

  return (
    <div className="flex flex-col gap-5">
      <label className="text-[10px] uppercase tracking-wider text-violet-300/70">{t('radar.filters.sector')}
        <select className={`${sel} mt-1`} value={sector} onChange={(e) => setSector(e.target.value as SectorId)}>
          {SECTORS.map((s) => <option key={s} value={s}>{t(`radar.sector.${s}`)}</option>)}
        </select>
      </label>

      <section>
        <SectionTitle aside={<Chip tone="amber">{t('radar.trends.label.analysis')}</Chip>}>{t('radar.trends.momentum')}</SectionTitle>
        <LoadBlock s={mom} onRetry={() => setTick((n) => n + 1)}>
          {(m) => {
            const r1 = median(m.rows.map((r) => r.ret1m).filter((x): x is number => x !== null));
            const r3 = median(m.rows.map((r) => r.ret3m).filter((x): x is number => x !== null));
            if (m.rows.length === 0) return <p className="text-xs text-violet-200/55">{t('radar.trends.noListed')}</p>;
            return (
              <div className="flex flex-col gap-3">
                <div className={`${cardCls} grid grid-cols-3 gap-2 p-3 text-center`}>
                  <div><p className="text-[10px] uppercase tracking-wider text-violet-300/60">{t('radar.q.ret1m')}</p><p className="text-lg font-semibold tabular-nums text-foreground">{m.rows.length >= 3 && r1 !== null ? formatPercent(r1, localeBcp47) : '—'}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-violet-300/60">{t('radar.q.ret3m')}</p><p className="text-lg font-semibold tabular-nums text-foreground">{m.rows.length >= 3 && r3 !== null ? formatPercent(r3, localeBcp47) : '—'}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-violet-300/60">{t('radar.trends.sample')}</p><p className="text-lg font-semibold tabular-nums text-foreground">{m.rows.length}</p></div>
                </div>
                {m.rows.length < 3 && <p className="text-[11px] text-amber-200/80">{t('radar.trends.smallSample')}</p>}
                <ul className="flex flex-col gap-1">
                  {m.rows.map((r) => (
                    <li key={r.company.id}>
                      <button onClick={() => onOpenCompany(r.company.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start hover:bg-violet-500/10 cursor-pointer">
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{r.company.name}</span>
                        <span className={`w-16 text-end text-xs tabular-nums ${(r.ret1m ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.ret1m === null ? '—' : formatPercent(r.ret1m, localeBcp47, 1)}</span>
                        <span className={`w-16 text-end text-xs tabular-nums ${(r.ret3m ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{r.ret3m === null ? '—' : formatPercent(r.ret3m, localeBcp47, 1)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] leading-snug text-violet-200/45">
                  {t('radar.trends.momentumNote', { n: m.rows.length })}{m.failed > 0 ? ` ${t('radar.trends.failedNote', { n: m.failed })}` : ''}
                </p>
              </div>
            );
          }}
        </LoadBlock>
      </section>

      <section>
        <SectionTitle aside={<Chip tone="green">{t('radar.trends.label.reported')}</Chip>}>{t('radar.trends.headlines')}</SectionTitle>
        {Object.keys(themes).length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-xs text-violet-200/60">{t('radar.trends.headlinesHint')}</p>
            <button onClick={loadHeadlines} className={btnCls}><Newspaper size={13} /> {t('radar.trends.loadHeadlines')}</button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {THEMES.map((th) => {
              const s = themes[th.id] ?? { state: 'idle' as const };
              return (
                <div key={th.id}>
                  <p className="mb-1.5 text-xs font-semibold text-violet-100">{t(`radar.trends.theme.${th.id}`)}</p>
                  {s.state === 'loading' && <p className="flex items-center gap-2 text-xs text-violet-200/55"><Spinner size={13} /> {t('radar.trends.queued')}</p>}
                  <LoadBlock s={s.state === 'loading' ? { state: 'idle' } : s} onRetry={loadHeadlines} compact>
                    {(items) => items.length === 0 ? (
                      <p className="text-xs text-violet-200/50">{t('radar.company.noNews')}</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {items.map((n) => (
                          <li key={n.url} className="rounded-lg border border-violet-500/15 bg-violet-950/20 p-2.5">
                            <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-[13px] leading-snug text-foreground hover:text-violet-100">{n.title}</a>
                            <p className="mt-0.5 text-[10px] text-violet-200/45">{n.domain}{n.date ? ` · ${formatDateTime(n.date, localeBcp47)}` : ''}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </LoadBlock>
                </div>
              );
            })}
            <p className="text-[10px] text-violet-200/40">GDELT Project · {t('radar.company.newsNote')}</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-violet-500/15 bg-violet-950/25 p-3">
        <div className="flex items-start gap-2">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-violet-300/70" />
          <div className="space-y-1 text-[11px] leading-snug text-violet-200/60">
            <p className="flex items-center gap-1.5"><Chip tone="slate">{t('radar.trends.label.projection')}</Chip> {t('radar.trends.noProjection')}</p>
            <p>{t('radar.trends.disclaimer')}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
