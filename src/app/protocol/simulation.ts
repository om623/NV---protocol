/**
 * ─── NV Protocol — Simulation engine constants & helpers ─────────────────────
 * The deterministic simulation pipeline lives here so both the ProtocolProvider
 * (state) and the dashboard UI (rendering) share one source of truth.
 */
import {
  Wallet, Shield, Database, Activity, TrendingUp, AlertTriangle,
  Target, Cpu, Check, CheckCircle2,
} from 'lucide-react';

export interface SimHistoryItem {
  id: string;
  datetime: string;
  roi: number;
  risk: number;
  duration: number;
  strategy: string;
  pools: number;
  opportunities: number;
  fromToken: string;
  toToken: string;
}

export interface RoiPoint { t: number; roi: number; }

export const PIPELINE_STEPS = [
  { label: 'Conectando carteira...',           Icon: Wallet },
  { label: 'Validando assinatura...',          Icon: Shield },
  { label: 'Lendo saldo...',                   Icon: Database },
  { label: 'Escaneando pools de liquidez...',  Icon: Activity },
  { label: 'Analisando oportunidades...',      Icon: TrendingUp },
  { label: 'Calculando risco...',              Icon: AlertTriangle },
  { label: 'Selecionando estratégia ótima...', Icon: Target },
  { label: 'Simulando execução...',            Icon: Cpu },
  { label: 'Confirmando resultados...',        Icon: Check },
  { label: 'Finalizado.',                      Icon: CheckCircle2 },
];

export const CONSOLE_SCRIPT: { type: 'info' | 'success' | 'warn'; text: string; delay: number }[] = [
  { type: 'info',    text: 'Wallet connected',         delay: 350  },
  { type: 'info',    text: 'Reading balances...',      delay: 1400 },
  { type: 'warn',    text: 'High volatility detected', delay: 2400 },
  { type: 'info',    text: '23 pools analyzed',        delay: 3500 },
  { type: 'info',    text: '7 opportunities found',    delay: 5000 },
  { type: 'info',    text: 'Best ROI selected',        delay: 6700 },
  { type: 'info',    text: 'Running final checks...',  delay: 7900 },
  { type: 'success', text: 'Simulation completed',     delay: 8900 },
];

export const BADGES = [
  { label: 'Secure Wallet',       color: 'text-cyan-400',    border: 'border-cyan-400/30',    bg: 'bg-cyan-400/8'    },
  { label: 'AI Strategy',         color: 'text-violet-400',  border: 'border-violet-400/30',  bg: 'bg-violet-400/8'  },
  { label: 'Smart Routing',       color: 'text-blue-400',    border: 'border-blue-400/30',    bg: 'bg-blue-400/8'    },
  { label: 'Simulation Complete', color: 'text-emerald-400', border: 'border-emerald-400/30', bg: 'bg-emerald-400/8' },
];

export const SIM_TOTAL_MS = 9700;
export const ROI_START_MS = 6700;
export const ROI_DURATION_MS = 1400;
export const ROI_TARGET = 8.47;

export function getNextSimId(): string {
  try {
    const count = parseInt(localStorage.getItem('vault-sim-count') || '0') + 1;
    localStorage.setItem('vault-sim-count', String(count));
    const d = new Date();
    const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `SIM-${ds}-${String(count).padStart(4, '0')}`;
  } catch {
    return `SIM-${Date.now()}`;
  }
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function generateReportHtml(data: {
  simId: string; datetime: string; wallet: string;
  fromToken: string; toToken: string; fromAmount: number; toAmount: number;
  totalTime: number; roi: number; risk: number;
  strategy: string; pools: number; opportunities: number;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório — ${data.simId}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Courier New',monospace;background:#070c18;color:#c8d8e8;padding:0}
.page{max-width:680px;margin:0 auto;padding:52px 44px}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:36px}
.brand-icon{width:36px;height:36px;background:rgba(0,229,188,.15);border:1px solid rgba(0,229,188,.3);border-radius:10px;display:flex;align-items:center;justify-content:center}
.brand-name{font-size:14px;font-weight:700;letter-spacing:4px;color:#e2e8f0}
.brand-sub{font-size:9px;color:#00e5bc;letter-spacing:3px;text-transform:uppercase;margin-top:3px}
.divider{height:1px;background:linear-gradient(to right,rgba(0,229,188,.4),transparent);margin:24px 0}
.title{font-size:22px;font-weight:700;color:#f8fafc;margin-bottom:6px}
.sim-id{font-size:11px;color:#00e5bc;letter-spacing:1px;margin-bottom:4px}
.dt{font-size:11px;color:#64748b}
.section-title{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#475569;margin:28px 0 12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.field{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px 16px}
.field-label{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#475569;margin-bottom:6px}
.field-value{font-size:14px;color:#e2e8f0}
.field-value.accent{color:#00e5bc}
.field-value.green{color:#34d399}
.field-value.yellow{color:#fbbf24}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}
.badge{display:inline-flex;align-items:center;gap:5px;background:rgba(0,229,188,.08);border:1px solid rgba(0,229,188,.2);border-radius:999px;padding:5px 12px;font-size:10px;color:#00e5bc}
.footer{margin-top:48px;padding-top:20px;border-top:1px solid rgba(255,255,255,.06);font-size:10px;color:#1e293b;display:flex;justify-content:space-between}
@media print{body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style></head><body><div class="page">
<div class="brand">
  <div class="brand-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5bc" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
  <div><div class="brand-name">NV PROTOCOL</div><div class="brand-sub">Protocol V3 · Simulation Report</div></div>
</div>
<div class="divider"></div>
<div class="title">Relatório de Simulação</div>
<div class="sim-id">${data.simId}</div>
<div class="dt">Executado em: ${data.datetime}</div>

<div class="section-title">Identificação</div>
<div class="grid">
  <div class="field"><div class="field-label">ID da Simulação</div><div class="field-value accent">${data.simId}</div></div>
  <div class="field"><div class="field-label">Carteira Conectada</div><div class="field-value">${data.wallet}</div></div>
</div>

<div class="section-title">Operação</div>
<div class="grid">
  <div class="field"><div class="field-label">Token Origem</div><div class="field-value">${data.fromToken} &nbsp;(${data.fromAmount.toFixed(4)})</div></div>
  <div class="field"><div class="field-label">Token Destino</div><div class="field-value">${data.toToken} &nbsp;(${data.toAmount.toFixed(4)})</div></div>
</div>

<div class="section-title">Métricas</div>
<div class="grid">
  <div class="field"><div class="field-label">Tempo de Execução</div><div class="field-value">${data.totalTime.toFixed(2)}s</div></div>
  <div class="field"><div class="field-label">ROI Estimado</div><div class="field-value green">+${data.roi.toFixed(2)}%</div></div>
  <div class="field"><div class="field-label">Risco</div><div class="field-value yellow">${data.risk.toFixed(1)}% (Moderado)</div></div>
  <div class="field"><div class="field-label">Estratégia</div><div class="field-value">${data.strategy}</div></div>
  <div class="field"><div class="field-label">Pools Analisados</div><div class="field-value">${data.pools}</div></div>
  <div class="field"><div class="field-label">Oportunidades</div><div class="field-value">${data.opportunities}</div></div>
</div>

<div class="section-title">Verificações de Segurança</div>
<div class="badges">
  <span class="badge">✓ Secure Wallet</span>
  <span class="badge">✓ AI Strategy</span>
  <span class="badge">✓ Smart Routing</span>
  <span class="badge">✓ Simulation Complete</span>
</div>
<div class="footer">
  <span>NV Protocol V3</span>
  <span>Gerado em ${data.datetime}</span>
</div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),800))</script>
</body></html>`;
}

