import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import { SOURCES } from '../data/sources';
import { Chip, cardCls } from '../ui';

export function SourcesPanel() {
  const { t } = useI18n();
  const tone = { live: 'green', 'needs-config': 'amber', planned: 'slate' } as const;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-violet-200/65">{t('radar.sources.intro')}</p>
      <ul className="flex flex-col gap-2">
        {SOURCES.map((s) => (
          <li key={s.id} className={`${cardCls} p-3`}>
            <div className="flex items-start justify-between gap-2">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-violet-100">
                {s.name} <ExternalLink size={11} className="opacity-60" />
              </a>
              <Chip tone={tone[s.status]}>{t(`radar.sources.status.${s.status}`)}</Chip>
            </div>
            <p className="mt-1 text-xs text-violet-200/60">{t(`radar.sources.scope.${s.id}`)}</p>
            {s.requires && (
              <p className="mt-1 text-[11px] text-amber-200/80">{t('radar.sources.requires')} <code className="rounded bg-violet-500/15 px-1 font-mono text-[10px]">{s.requires}</code></p>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[10px] leading-snug text-violet-200/40">{t('radar.sources.policy')}</p>
    </div>
  );
}
