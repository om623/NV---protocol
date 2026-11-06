import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { useI18n } from '../i18n/context';

/** Suspense fallback: says what is happening, and hints after a few seconds instead of staying dark. */
export function RadarLoading() {
  const { t } = useI18n();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 9000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div role="status" className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center text-violet-200/80">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-300" />
      <p className="text-sm font-medium tracking-wide text-violet-100">{t('radar.loading.module')}</p>
      {slow && <p className="text-xs text-violet-200/60">{t('radar.loading.slow')}</p>}
    </div>
  );
}

/** A failed dynamic import is cached by the browser, so only a page reload can retry it. */
const isChunkError = (e: Error) => /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically/i.test(`${e.name} ${e.message}`);

/** Visible, translated fallback shown when the Radar module fails. */
function RadarCrash({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useI18n();
  const detail = `${error.name}: ${error.message}`.slice(0, 600);
  return (
    <div role="alert" className="mx-auto mt-6 max-w-xl rounded-3xl border border-violet-500/30 bg-[#0d0522]/90 p-6 text-center shadow-[0_0_40px_rgba(124,58,237,0.2)]">
      <TriangleAlert className="mx-auto mb-3 text-amber-300" size={28} />
      <h2 className="text-base font-semibold text-violet-100">{t('radar.crash.title')}</h2>
      <p className="mt-2 text-sm text-violet-200/70">{t('radar.crash.hint')}</p>
      <button onClick={onRetry} className="mt-4 cursor-pointer rounded-xl border border-violet-400/40 bg-violet-500/20 px-4 py-2 text-sm text-violet-50 hover:bg-violet-500/35">
        {t('radar.crash.retry')}
      </button>
      <details className="mt-4 text-start">
        <summary className="cursor-pointer text-xs text-violet-300/70">{t('radar.crash.detail')}</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-black/40 p-3 font-mono text-[10px] text-violet-200/70">{detail}</pre>
      </details>
    </div>
  );
}

interface State { error: Error | null; attempt: number }

/**
 * Isolates the Radar: an import failure or a render/effect exception here must never
 * unmount the rest of the application (which would leave only the dark page background).
 */
export class RadarBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Radar] module crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      const retry = () => {
        if (isChunkError(err)) window.location.reload();
        else this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
      };
      return <RadarCrash error={err} onRetry={retry} />;
    }
    // `attempt` changes the key so a retry fully remounts the module.
    return <div key={this.state.attempt} className="contents">{this.props.children}</div>;
  }
}
