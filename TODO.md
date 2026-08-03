# NV Protocol — Fase 2: Global Intelligence (Casa do Investidor)

> Regras: identidade visual, animações, UX e comportamento **inalterados**.
> Objetivo: transformar o NV Protocol na Casa do Investidor — todos os mercados
> globais em um único lugar, 100% modular via Registries + Data Layer + Providers.
> Build verde ao final de cada etapa, **um commit por etapa**, push ao final.

## ✓ Fase 1 (concluída)
- [x] ProtocolProvider centralizado (wallet, rede/env, swap, simulação, transações, histórico)
- [x] Registries, i18n, data sources, shell layout, ModuleRouter (lazy)
- [x] Build verde + identidade visual preservada

## ✓ Etapa 1 — Expandir Registries + Data Layer (commit 44cb600)
- [x] 15 índices mundiais (Ibovespa, SPX, NDX, DJI, Russell, DAX, CAC, FTSE, Nikkei, Hang Seng, Shanghai, Kospi, Sensex, ASX, Euro Stoxx)
- [x] Metais: Ouro, Prata, Platina, Paládio, Cobre
- [x] Energia: Brent, WTI, Gás Natural
- [x] Agro: Soja, Milho, Trigo, Café, Açúcar, Algodão
- [x] Pecuária: Boi Gordo, Gado de Corte, Gado de Reposição, Suínos, Frango
- [x] Cripto: + ADA, AVAX, LINK (CoinGecko)
- [x] Forex: 10 pares (USD, EUR, GBP, JPY, CHF, CAD, AUD, NZD, BRL, CNY)
- [x] Yahoo fetch paralelo + supports agro/livestock
- [x] Frankfurter batch + cross rates + variação real
- [x] CoinGecko mapa + ADA/AVAX/LINK
- [x] Build verde + commit + push

## ✓ Etapa 2 — GlobalMarketsProvider (commit 3a5ce3d)
- [x] `src/app/intelligence/GlobalMarketsProvider.tsx`: agrega assetRegistry + dataSourceRegistry
- [x] Atualização **desacoplada por categoria** (Crypto 30s, demais 60s — via `refreshMs` por ativo)
- [x] Expor `useGlobalMarkets()` (quotes por ativo, indicadores, últimos updates)
- [x] Build verde + commit + push

## ✓ Etapa 3 — Widgets independentes (commit b6e7df6)
- [x] `CategoryWidget` — genérico, data-driven, com **modos de visualização preparados** (cards, lista, mini-gráfico, heatmap, tabela)
- [x] `IndicatorsWidget` — Fear & Greed, BTC Dominance, Market Cap, Volume, última atualização
- [x] `MultiCategoryTicker` — ticker contínuo preparado p/ Forex, Commodities, Cripto, Índices e Notícias (começa em Forex)
- [x] `CategoryPanel` — painel completo p/ ModuleRouter + registrar `category.panel`
- [x] `indicatorRegistry` — nascer preparado com placeholders: VIX, DXY, Fed Funds, CPI, Treasury 2Y/10Y/30Y, PPI, PMI, Unemployment
- [x] Build verde + commit b6e7df6 + push (branch sincronizada com origin)

## ✓ Etapa 4 — Ativação no layout
- [x] `IntelligenceColumn` — compõe provider + widgets (fonte única)
- [x] `RightIntelligence` renderiza a coluna quando `enabled`
- [x] `App.tsx` — trocar `<GlobalMarketsPanel />` por `<GlobalMarketsProvider>` + `<IntelligenceColumn />` no `RightPanel` (painéis de simulação intactos)
- [x] `WorkspaceProvider` montado acima do `Router` (necessário para `useWorkspace().openCategory`)
- [x] Import `IntelligenceColumn` via path direto (sem ciclo no barrel `@/app/intelligence`)
- [x] i18n para labels novos
- [x] Build verde + commit + push

## ⏳ Futuro (fora da Fase 2)
- [ ] Fase 3 — Ticker permanente inferior
- [ ] Fase 4 — Fontes de dados premium substituíveis
- [ ] Fase 5 — Performance, cache em camadas, WebSocket/serverless
