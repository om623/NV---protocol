# NV Protocol — Fase 2: Global Intelligence (Casa do Investidor)

> Regras: identidade visual, animações, UX e comportamento **inalterados**.
> Objetivo: transformar o NV Protocol na Casa do Investidor — todos os mercados
> globais em um único lugar, 100% modular via Registries + Data Layer + Providers.
> Build verde ao final de cada etapa, **um commit por etapa**, push ao final.

## ✓ Fase 1 (concluída)
- [x] ProtocolProvider centralizado (wallet, rede/env, swap, simulação, transações, histórico)
- [x] Registries, i18n, data sources, shell layout, ModuleRouter (lazy)
- [x] Build verde + identidade visual preservada

## 🔄 Etapa 1 — Expandir Registries + Data Layer
- [ ] `assetRegistry`: adicionar todos os ativos obrigatórios
  - [ ] 15 índices mundiais (Ibovespa, SPX, NDX, DJI, Russell, DAX, CAC, FTSE, Nikkei, Hang Seng, Shanghai, Kospi, Sensex, ASX, Euro Stoxx)
  - [ ] Metais: Ouro, Prata, Platina, Paládio, Cobre
  - [ ] Energia: Brent, WTI, Gás Natural
  - [ ] Agro: Soja, Milho, Trigo, Café, Açúcar, Algodão
  - [ ] Pecuária: Boi Gordo, Gado de Corte, Gado de Reposição, Suínos, Frango
  - [ ] Cripto: + ADA, AVAX, LINK (CoinGecko)
  - [ ] Forex: 10 pares (USD, EUR, GBP, JPY, CHF, CAD, AUD, NZD, BRL, CNY)
- [ ] `yahoo.ts`: fetch **paralelo** + supports `agro`, `livestock`
- [ ] `frankfurter.ts`: **batch** + cross rates + variação real (2 requests totais)
- [ ] `coingecko.ts`: mapa + ADA, AVAX, LINK
- [ ] Build verde + commit + push

## ⏳ Etapa 2 — GlobalMarketsProvider
- [ ] `src/app/intelligence/GlobalMarketsProvider.tsx`: agrega assetRegistry + dataSourceRegistry
- [ ] Atualização **desacoplada por categoria** (Crypto 30s, demais 60s — via `refreshMs` por ativo)
- [ ] Expor `useGlobalMarkets()` (quotes por ativo, indicadores, últimos updates)
- [ ] Build verde + commit + push

## ⏳ Etapa 3 — Widgets independentes
- [ ] `CategoryWidget` — genérico, data-driven, com **modos de visualização preparados** (cards, lista, mini-gráfico, heatmap, tabela)
- [ ] `IndicatorsWidget` — Fear & Greed, BTC Dominance, Market Cap, Volume, última atualização
- [ ] `MultiCategoryTicker` — ticker contínuo preparado p/ Forex, Commodities, Cripto, Índices e Notícias (começa em Forex)
- [ ] `CategoryPanel` — painel completo p/ ModuleRouter + registrar `category.panel`
- [ ] `indicatorRegistry` — nascer preparado com placeholders: VIX, DXY, Fed Funds, CPI, Treasury 2Y/10Y/30Y, PPI, PMI, Unemployment
- [ ] Build verde + commit + push

## ⏳ Etapa 4 — Ativação no layout
- [ ] `IntelligenceColumn` — compõe provider + widgets (fonte única)
- [ ] `RightIntelligence` renderiza a coluna quando `enabled`
- [ ] `App.tsx` — **1 linha**: trocar `<GlobalMarketsPanel />` por `<IntelligenceColumn />` no `RightPanel` (painéis de simulação intactos)
- [ ] i18n para labels novos
- [ ] Build verde + commit + push

## ⏳ Futuro (fora da Fase 2)
- [ ] Fase 3 — Ticker permanente inferior
- [ ] Fase 4 — Fontes de dados premium substituíveis
- [ ] Fase 5 — Performance, cache em camadas, WebSocket/serverless

