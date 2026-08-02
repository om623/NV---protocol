# NV Protocol — Fase 0: Fundação & Refactor modular

> Regras: identidade visual, animações, UX e layout **inalterados** durante Fase 0/1.
> Objetivo: consolidar arquitetura, modularização, escalabilidade e preparação para i18n.

## ✓ Concluído
- [x] Contratos de tipos (`src/app/registry/types.ts`)
- [x] i18n infra + catálogo PT-BR + hook `useTranslation` (`src/i18n/`)
- [x] Camada de dados desacoplada (`src/data/types.ts` + 5 fontes: coingecko, yahoo, alternativeMe, frankfurter, brapi)
- [x] Registries: moduleRegistry, categoryRegistry, assetRegistry, indicatorRegistry, dataSourceRegistry, marketRegistry
- [x] Shell de layout: AppShell, LeftNav, RightIntelligence (zona reservada), Workspace/useWorkspace, ModuleRouter (lazy)
- [x] Módulos registrados (lazy): dashboard, swap, wallet, pools, simulation, bridge, history, gamification, settings, markets
- [x] `useWorkspace.tsx` (JSX → `.tsx`) + build verde
- [x] `DashboardModule` re-exporta `Home` de `@/App` — **monólito preservado durante Fase 0**
- [x] `App.tsx` exporta `Home` (entrypoint atual inalterado — `AppShell`/`ModuleRouter` são estruturais e inertes nesta fase)
- [x] Build verde + revisão de comportamento (runtime idêntico ao anterior)

## 🔄 Em andamento
- (nenhum)

## ⏳ Próximas fases (fora do escopo da Fase 0)
- [ ] Fase 1 — Extrair de verdade os módulos (swap, wallet, pools, simulation, dashboard) e migrar textos para i18n
- [ ] Fase 2 — Ativar RightIntelligence (indicadores + categorias)
- [ ] Fase 3 — Ticker permanente inferior
- [ ] Fase 4 — Fontes de dados premium substituíveis
- [ ] Fase 5 — Performance, cache em camadas, WebSocket/serverless

