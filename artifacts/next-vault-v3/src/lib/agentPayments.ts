// NV Agent autonomous-payment policy engine.
//
// IMPORTANT:
// - Pure policy/intent logic only.
// - This module DOES NOT import wallet providers and CANNOT sign/send transactions.
// - Swap, Bridge, payments.ts and market-data pipelines are intentionally untouched.

export type AgentPaymentEnvironment = 'testnet' | 'mainnet';

export interface AgentPaymentPolicy {
  id: string;
  name: string;
  enabled: boolean;
  environment: AgentPaymentEnvironment;
  chainId: number;
  tokenSymbol: string;
  recipient: string;
  maxAmountPerPayment: number;
  maxTotalAmount: number;
  spentAmount: number;
  validFromMs?: number;
  validUntilMs?: number;
}

export interface AgentPaymentRequest {
  policyId: string;
  amount: number;
  recipient: string;
  chainId: number;
  tokenSymbol: string;
  reason: string;
  requestedAtMs: number;
}

export interface AgentPaymentIntent extends AgentPaymentRequest {
  intentId: string;
  status: 'prepared';
  remainingPolicyBudget: number;
}

export type PolicyDecision =
  | { allowed: true; remainingAfterPayment: number }
  | { allowed: false; reason: string };

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export function validatePaymentPolicy(policy: AgentPaymentPolicy): string[] {
  const errors: string[] = [];
  if (!policy.id.trim()) errors.push('Policy id is required.');
  if (!policy.name.trim()) errors.push('Policy name is required.');
  if (!Number.isInteger(policy.chainId) || policy.chainId <= 0) errors.push('chainId must be a positive integer.');
  if (!policy.tokenSymbol.trim()) errors.push('Token symbol is required.');
  if (!EVM_ADDRESS.test(policy.recipient)) errors.push('Recipient must be a valid EVM address.');
  if (!Number.isFinite(policy.maxAmountPerPayment) || policy.maxAmountPerPayment <= 0) errors.push('Per-payment limit must be positive.');
  if (!Number.isFinite(policy.maxTotalAmount) || policy.maxTotalAmount <= 0) errors.push('Total limit must be positive.');
  if (!Number.isFinite(policy.spentAmount) || policy.spentAmount < 0) errors.push('Spent amount cannot be negative.');
  if (policy.maxAmountPerPayment > policy.maxTotalAmount) errors.push('Per-payment limit cannot exceed total limit.');
  if (policy.spentAmount > policy.maxTotalAmount) errors.push('Spent amount cannot exceed total limit.');
  if (policy.validFromMs !== undefined && policy.validUntilMs !== undefined && policy.validFromMs >= policy.validUntilMs) {
    errors.push('Policy validity window is invalid.');
  }
  return errors;
}

export function evaluatePaymentRequest(
  policy: AgentPaymentPolicy,
  request: AgentPaymentRequest,
): PolicyDecision {
  const errors = validatePaymentPolicy(policy);
  if (errors.length) return { allowed: false, reason: errors[0] };
  if (!policy.enabled) return { allowed: false, reason: 'Policy is disabled.' };
  if (request.policyId !== policy.id) return { allowed: false, reason: 'Policy id mismatch.' };
  if (!Number.isFinite(request.amount) || request.amount <= 0) return { allowed: false, reason: 'Amount must be positive.' };
  if (request.chainId !== policy.chainId) return { allowed: false, reason: 'Chain is outside the policy.' };
  if (request.tokenSymbol.toUpperCase() !== policy.tokenSymbol.toUpperCase()) return { allowed: false, reason: 'Token is outside the policy.' };
  if (request.recipient.toLowerCase() !== policy.recipient.toLowerCase()) return { allowed: false, reason: 'Recipient is outside the policy.' };
  if (request.amount > policy.maxAmountPerPayment) return { allowed: false, reason: 'Per-payment limit exceeded.' };
  if (policy.validFromMs !== undefined && request.requestedAtMs < policy.validFromMs) return { allowed: false, reason: 'Policy is not active yet.' };
  if (policy.validUntilMs !== undefined && request.requestedAtMs > policy.validUntilMs) return { allowed: false, reason: 'Policy has expired.' };

  const remaining = policy.maxTotalAmount - policy.spentAmount;
  if (request.amount > remaining) return { allowed: false, reason: 'Total policy budget exceeded.' };
  return { allowed: true, remainingAfterPayment: remaining - request.amount };
}

function stableIntentId(request: AgentPaymentRequest): string {
  // Deterministic local identifier for audit/dry-run. Not a signature or security token.
  const raw = [
    request.policyId,
    request.chainId,
    request.tokenSymbol.toUpperCase(),
    request.recipient.toLowerCase(),
    request.amount,
    request.requestedAtMs,
    request.reason,
  ].join('|');
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `nvpi_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function preparePaymentIntent(
  policy: AgentPaymentPolicy,
  request: AgentPaymentRequest,
): AgentPaymentIntent {
  const decision = evaluatePaymentRequest(policy, request);
  if (!decision.allowed) throw new Error(decision.reason);
  return {
    ...request,
    intentId: stableIntentId(request),
    status: 'prepared',
    remainingPolicyBudget: decision.remainingAfterPayment,
  };
}
