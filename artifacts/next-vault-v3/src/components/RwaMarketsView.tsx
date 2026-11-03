import { useMemo, useState } from 'react';
import { Building2, Coins, Landmark, Search, ShieldCheck, TrendingUp } from 'lucide-react';

type RwaCategory = 'Todos' | 'Treasuries' | 'Crédito' | 'Imóveis' | 'Commodities';

type RwaMarket = {
  symbol: string;
  name: string;
  category: Exclude<RwaCategory, 'Todos'>;
  network: string;
  issuer: string;
  status: 'Disponível' | 'Descoberta';
  note: string;
};

const RWA_MARKETS: RwaMarket[] = [
  { symbol: 'OUSG', name: 'Ondo Short-Term US Government Treasuries', category: 'Treasuries', network: 'Ethereum', issuer: 'Ondo', status: 'Descoberta', note: 'Exposição tokenizada a Treasuries; elegibilidade depende do emissor.' },
  { symbol: 'USDY', name: 'Ondo US Dollar Yield', category: 'Treasuries', network: 'Multichain', issuer: 'Ondo', status: 'Descoberta', note: 'Ativo tokenizado com rendimento; disponibilidade varia por jurisdição.' },
  { symbol: 'BUIDL', name: 'BlackRock USD Institutional Digital Liquidity Fund', category: 'Treasuries', network: 'Multichain', issuer: 'Securitize / BlackRock', status: 'Descoberta', note: 'Fundo tokenizado institucional; acesso sujeito a requisitos do produto.' },
  { symbol: 'BENJI', name: 'Franklin OnChain U.S. Government Money Fund', category: 'Treasuries', network: 'Multichain', issuer: 'Franklin Templeton', status: 'Descoberta', note: 'Representação onchain de fundo monetário.' },
  { symbol: 'PAXG', name: 'PAX Gold', category: 'Commodities', network: 'Ethereum', issuer: 'Paxos', status: 'Disponível', note: 'Token referenciado a ouro físico conforme termos do emissor.' },
  { symbol: 'XAUT', name: 'Tether Gold', category: 'Commodities', network: 'Ethereum', issuer: 'Tether Gold', status: 'Descoberta', note: 'Token referenciado a ouro conforme termos do emissor.' },
  { symbol: 'RWA-CREDIT', name: 'Private Credit Markets', category: 'Crédito', network: 'Multichain', issuer: 'Vários', status: 'Descoberta', note: 'Camada de descoberta para crédito privado tokenizado.' },
  { symbol: 'RWA-RE', name: 'Tokenized Real Estate', category: 'Imóveis', network: 'Multichain', issuer: 'Vários', status: 'Descoberta', note: 'Camada de descoberta para imóveis e participações tokenizadas.' },
];

const CATEGORIES: RwaCategory[] = ['Todos', 'Treasuries', 'Crédito', 'Imóveis', 'Commodities'];

export function RwaMarketsView() {
  const [category, setCategory] = useState<RwaCategory>('Todos');
  const [query, setQuery] = useState('');

  const markets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RWA_MARKETS.filter((asset) => {
      const categoryMatch = category === 'Todos' || asset.category === category;
      const queryMatch = !q || [asset.symbol, asset.name, asset.issuer, asset.network, asset.category]
        .some((value) => value.toLowerCase().includes(q));
      return categoryMatch && queryMatch;
    });
  }, [category, query]);

  return (
    <section className="flex flex-col gap-4" aria-label="Mercados RWA">
      <div className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Landmark size={18} />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em]">NV Tokenized Markets</span>
            </div>
            <h2 className="mt-2 text-xl font-semibold">RWA Markets</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Descoberta de ativos do mundo real tokenizados, preparada para futuras rotas de trading e bridge.
            </p>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[9px] font-mono uppercase text-primary">
            Foundation
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric icon={<Coins size={14} />} label="Mercados" value={String(RWA_MARKETS.length)} />
          <Metric icon={<Building2 size={14} />} label="Classes" value="4" />
          <Metric icon={<ShieldCheck size={14} />} label="Execução" value="Protegida" />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar ativo, emissor ou rede"
            className="w-full rounded-xl border border-border/60 bg-background/60 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-primary/50"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-mono transition ${
                category === item ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {markets.map((asset) => (
          <article key={asset.symbol} className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <strong className="text-sm">{asset.symbol}</strong>
                  <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">{asset.category}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{asset.name}</p>
              </div>
              <span className="shrink-0 rounded-full border border-border/60 px-2 py-1 text-[9px] font-mono text-muted-foreground">{asset.status}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-lg bg-muted/30 p-2"><span className="text-muted-foreground">Emissor</span><div className="mt-0.5">{asset.issuer}</div></div>
              <div className="rounded-lg bg-muted/30 p-2"><span className="text-muted-foreground">Rede</span><div className="mt-0.5">{asset.network}</div></div>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">{asset.note}</p>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-primary/80">
              <TrendingUp size={12} />
              Trading/bridge somente quando houver rota suportada e elegibilidade verificada.
            </div>
          </article>
        ))}
        {markets.length === 0 && <div className="py-10 text-center text-xs text-muted-foreground">Nenhum mercado RWA encontrado.</div>}
      </div>

      <p className="px-1 text-[9px] leading-relaxed text-muted-foreground/70">
        O NV não presume que todos os RWAs estejam disponíveis para todos os usuários. Regras de emissor, rede, liquidez, KYC e jurisdição serão verificadas antes de habilitar execução.
      </p>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl bg-muted/30 p-2.5"><div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[9px]">{label}</span></div><div className="mt-1 text-xs font-semibold">{value}</div></div>;
}
