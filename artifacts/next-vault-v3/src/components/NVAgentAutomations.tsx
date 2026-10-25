import { useMemo, useState } from 'react';
import { Bot, CheckCircle2, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';
import {
  evaluatePaymentRequest,
  preparePaymentIntent,
  validatePaymentPolicy,
  type AgentPaymentPolicy,
} from '../lib/agentPayments';

const SAMPLE_RECIPIENT = '0x1111111111111111111111111111111111111111';

export function NVAgentAutomations() {
  const [enabled, setEnabled] = useState(false);
  const [amount, setAmount] = useState('5');
  const [limit, setLimit] = useState('25');
  const [total, setTotal] = useState('100');
  const [recipient, setRecipient] = useState(SAMPLE_RECIPIENT);
  const [preview, setPreview] = useState<string | null>(null);

  const policy = useMemo<AgentPaymentPolicy>(() => ({
    id: 'nv-preview-policy',
    name: 'NV Agent Preview Policy',
    enabled,
    environment: 'testnet',
    chainId: 84532,
    tokenSymbol: 'USDC',
    recipient,
    maxAmountPerPayment: Number(limit),
    maxTotalAmount: Number(total),
    spentAmount: 0,
  }), [enabled, limit, total, recipient]);

  const errors = validatePaymentPolicy(policy);

  function simulate() {
    if (errors.length) {
      setPreview(errors[0]);
      return;
    }
    const request = {
      policyId: policy.id,
      amount: Number(amount),
      recipient: policy.recipient,
      chainId: policy.chainId,
      tokenSymbol: policy.tokenSymbol,
      reason: 'NV Agent automation preview',
      requestedAtMs: Date.now(),
    };
    const decision = evaluatePaymentRequest(policy, request);
    if (!decision.allowed) {
      setPreview(`Blocked: ${decision.reason}`);
      return;
    }
    const intent = preparePaymentIntent(policy, request);
    setPreview(`DRY-RUN APPROVED · ${amount} USDC · ${intent.intentId} · remaining ${intent.remainingPolicyBudget} USDC`);
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-card/70 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Zap size={14} className="text-primary" />
        </div>
        <div>
          <div className="text-xs font-semibold">NV Agent Automations</div>
          <div className="text-[9px] font-mono text-muted-foreground/50">CRE-ready · policy engine · dry-run</div>
        </div>
        <span className="ml-auto text-[9px] font-mono px-2 py-1 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-400">TESTNET PREVIEW</span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="rounded-xl border border-border/30 bg-secondary/15 p-3">
            <ShieldCheck size={13} className="text-emerald-400 mb-2" />
            <div className="text-[10px] font-semibold">Policy guard</div>
            <div className="text-[9px] text-muted-foreground/50 mt-1">Recipient, network and limits are locked.</div>
          </div>
          <div className="rounded-xl border border-border/30 bg-secondary/15 p-3">
            <Bot size={13} className="text-primary mb-2" />
            <div className="text-[10px] font-semibold">NV Agent isolated</div>
            <div className="text-[9px] text-muted-foreground/50 mt-1">No Dashboard presenter dependency.</div>
          </div>
          <div className="rounded-xl border border-border/30 bg-secondary/15 p-3">
            <CheckCircle2 size={13} className="text-cyan-400 mb-2" />
            <div className="text-[10px] font-semibold">No signing</div>
            <div className="text-[9px] text-muted-foreground/50 mt-1">Preview creates intents only.</div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-[10px] text-muted-foreground/60">Recipient
            <input value={recipient} onChange={e => setRecipient(e.target.value)} className="mt-1 w-full rounded-lg border border-border/40 bg-background/60 px-2.5 py-2 text-[10px] font-mono text-foreground" />
          </label>
          <label className="text-[10px] text-muted-foreground/60">Payment amount (USDC)
            <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-border/40 bg-background/60 px-2.5 py-2 text-xs text-foreground" />
          </label>
          <label className="text-[10px] text-muted-foreground/60">Max per payment (USDC)
            <input value={limit} onChange={e => setLimit(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-border/40 bg-background/60 px-2.5 py-2 text-xs text-foreground" />
          </label>
          <label className="text-[10px] text-muted-foreground/60">Total policy budget (USDC)
            <input value={total} onChange={e => setTotal(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-border/40 bg-background/60 px-2.5 py-2 text-xs text-foreground" />
          </label>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border/30 px-3 py-2.5">
          <button type="button" onClick={() => { setEnabled(v => !v); setPreview(null); }} className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-secondary'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
          <div>
            <div className="text-[10px] font-semibold">{enabled ? 'Policy enabled' : 'Policy disabled'}</div>
            <div className="text-[9px] text-muted-foreground/50">Base Sepolia (84532) · USDC · dry-run only</div>
          </div>
          <button type="button" onClick={simulate} className="ml-auto rounded-lg bg-primary/10 border border-primary/25 px-3 py-1.5 text-[10px] font-semibold text-primary hover:bg-primary/20">Simulate</button>
        </div>

        {preview && <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-mono ${preview.startsWith('DRY-RUN') ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-amber-500/20 bg-amber-500/5 text-amber-400'}`}>
          {preview.startsWith('DRY-RUN') ? <CheckCircle2 size={12} className="shrink-0" /> : <AlertTriangle size={12} className="shrink-0" />}
          <span>{preview}</span>
        </div>}
      </div>
    </div>
  );
}
