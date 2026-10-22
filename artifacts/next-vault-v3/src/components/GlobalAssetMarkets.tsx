import { useEffect, useState } from 'react';
import { ExternalLink, Image as ImageIcon, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';

type NftCollection = {
  id?: string;
  name?: string;
  image?: string;
  floorAsk?: { price?: { amount?: { native?: number; usd?: number }; currency?: { symbol?: string } } };
  volume?: { '1day'?: number; '7day'?: number };
  tokenCount?: number;
};
type ReservoirResponse = { collections?: NftCollection[] };
type XStockPrice = { symbol: string; name: string; price: number | null };

const NFT_API_KEY = (import.meta.env.VITE_RESERVOIR_API_KEY as string | undefined)?.trim();
const NFT_API = 'https://api.reservoir.tools/collections/v7?sortBy=1DayVolume&limit=5&excludeSpam=true&excludeNsfw=true';

const usd = (value?: number) => typeof value === 'number' && Number.isFinite(value)
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 4 : 2 }).format(value)
  : '—';
const compact = (value?: number) => typeof value === 'number' && Number.isFinite(value)
  ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
  : '—';

export function GlobalAssetMarkets() {
  const [collections, setCollections] = useState<NftCollection[]>([]);
  const [xstockPrices, setXstockPrices] = useState<XStockPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'ready' | 'loaded' | 'missing-key' | 'unavailable'>('ready');

  useEffect(() => {
    let cancelled = false;
    const symbols = [
      { symbol: 'AAPLx', name: 'Apple' }, { symbol: 'NVDAx', name: 'NVIDIA' },
      { symbol: 'TSLAx', name: 'Tesla' }, { symbol: 'AMZNx', name: 'Amazon' },
      { symbol: 'GOOGLx', name: 'Alphabet' }, { symbol: 'SPYx', name: 'ETF S&P 500' },
    ];
    const loadXStocks = async () => {
      const quotes = await Promise.all(symbols.map(async item => {
        try {
          const response = await fetch('https://api.xstocks.fi/api/v2/public/assets/' + encodeURIComponent(item.symbol) + '/price-data', { headers: { Accept: 'application/json' } });
          if (!response.ok) throw new Error('xStocks quote unavailable');
          const data = await response.json() as { quote?: number | null };
          return { symbol: item.symbol, name: item.name, price: typeof data.quote === 'number' && Number.isFinite(data.quote) && data.quote > 0 ? data.quote : null };
        } catch {
          return { symbol: item.symbol, name: item.name, price: null };
        }
      }));
      if (!cancelled) setXstockPrices(quotes);
    };
    void loadXStocks();
    const xTimer = window.setInterval(() => void loadXStocks(), 120_000);
    return () => { cancelled = true; window.clearInterval(xTimer); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!NFT_API_KEY) { setStatus('missing-key'); return; }
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(NFT_API, { headers: { accept: 'application/json', 'x-api-key': NFT_API_KEY } });
        if (!response.ok) throw new Error('NFT provider unavailable');
        const payload = await response.json() as ReservoirResponse;
        if (!cancelled) {
          setCollections(payload.collections ?? []);
          setStatus((payload.collections ?? []).length ? 'loaded' : 'unavailable');
        }
      } catch {
        if (!cancelled) setStatus('unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 120_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  return (
    <section className="w-full rounded-2xl border border-white/[0.06] bg-card/85 backdrop-blur-xl p-3 sm:p-4 shadow-[0_4px_24px_rgba(0,0,0,0.16)]">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Global Markets · Ativos tokenizados & NFTs</h2>
          <p className="text-[10px] text-muted-foreground/55 mt-0.5">Mercados separados por tipo de ativo · cotações indicativas</p>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/55"><ShieldCheck size={13} /> Dados sem valores inventados</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/40 bg-secondary/15 p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={15} className="text-primary" />
            <div className="text-xs font-semibold text-foreground">Ações tokenizadas · xStocks</div>
            <span className="ml-auto text-[9px] rounded-full border border-primary/20 bg-primary/10 text-primary px-1.5 py-0.5">API pública</span>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground/60 mb-3">Preços indicativos dos tokens xStocks. São representações tokenizadas de ações/ETFs, não ações tradicionais nem execução de ordens.</p>
          <div className="space-y-1.5">
            {xstockPrices.map(item => (
              <div key={item.symbol} className="flex items-center gap-2 border-b border-border/30 pb-1.5 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono text-foreground">{item.symbol}</div>
                  <div className="text-[9px] text-muted-foreground/50">{item.name}</div>
                </div>
                <div className="text-[11px] font-mono text-foreground">{item.price === null ? '—' : usd(item.price)}</div>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground/40 mt-2">Fonte: API pública xStocks · — significa que a cotação não está disponível. <a href="https://xstocks.fi/" target="_blank" rel="noreferrer" className="underline underline-offset-2">Ver xStocks ↗</a></p>
        </div>
        <div className="rounded-xl border border-border/40 bg-secondary/15 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon size={15} className="text-fuchsia-400" />
            <div className="text-xs font-semibold text-foreground">Mercado NFT</div>
            <span className="ml-auto text-[9px] rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300 px-1.5 py-0.5">Coleções</span>
          </div>
          {loading ? (
            <p className="text-xs text-muted-foreground py-2">Consultando mercado NFT…</p>
          ) : status === 'missing-key' ? (
            <>
              <p className="text-[11px] leading-relaxed text-muted-foreground/70">O painel está preparado, mas para exibir floor price e volume reais é necessário configurar uma chave gratuita da Reservoir como <code>VITE_RESERVOIR_API_KEY</code>. Não exibimos estatísticas simuladas.</p>
              <a href="https://reservoir.tools/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-3 rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/10 px-2.5 py-1.5 text-[10px] text-fuchsia-300">Obter acesso à API <ExternalLink size={11} /></a>
            </>
          ) : status === 'unavailable' || collections.length === 0 ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground/70">A fonte NFT não respondeu ou não retornou coleções. Tente novamente mais tarde; nenhum volume ou preço foi estimado.</p>
          ) : (
            <div className="space-y-2">
              {collections.map((collection, index) => (
                <div key={collection.id ?? collection.name ?? index} className="flex items-center gap-2 border-b border-border/30 pb-2 last:border-0 last:pb-0">
                  {collection.image
                    ? <img src={collection.image} alt="" className="w-7 h-7 rounded-lg object-cover bg-secondary" loading="lazy" />
                    : <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center"><ImageIcon size={13} /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-foreground">{collection.name ?? 'Coleção NFT'}</div>
                    <div className="text-[9px] text-muted-foreground/55">Volume 24h · {compact(collection.volume?.['1day'])}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-foreground">{usd(collection.floorAsk?.price?.amount?.usd)}</div>
                    <div className="text-[8px] text-muted-foreground/45">floor USD</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[9px] text-muted-foreground/40 mt-2">Fonte: Reservoir · floor price e volume dependem da disponibilidade da API e da rede selecionada pelo provedor.</p>
        </div>
      </div>
    </section>
  );
}
