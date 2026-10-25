#!/usr/bin/env node
// NV Agent policy CLI — dry-run only.
// It never imports wallet code and never sends a transaction.

const usage = () => {
  console.log(`NV Agent policy preview

Usage:
  node cli/nv-agent-policy.mjs validate <policy.json>
  node cli/nv-agent-policy.mjs preview <policy.json> <request.json>

Safety:
  This CLI validates and previews policies only. It cannot sign or send transactions.
`);
};

const isAddress = (v) => /^0x[a-fA-F0-9]{40}$/.test(v);

function validate(p) {
  const errors = [];
  if (!p?.id || typeof p.id !== 'string') errors.push('Policy id is required.');
  if (!p?.name || typeof p.name !== 'string') errors.push('Policy name is required.');
  if (!Number.isInteger(p?.chainId) || p.chainId <= 0) errors.push('chainId must be a positive integer.');
  if (!isAddress(p?.recipient ?? '')) errors.push('Recipient must be a valid EVM address.');
  if (!Number.isFinite(p?.maxAmountPerPayment) || p.maxAmountPerPayment <= 0) errors.push('Per-payment limit must be positive.');
  if (!Number.isFinite(p?.maxTotalAmount) || p.maxTotalAmount <= 0) errors.push('Total limit must be positive.');
  if (!Number.isFinite(p?.spentAmount) || p.spentAmount < 0) errors.push('Spent amount cannot be negative.');
  return errors;
}

async function readJson(path) {
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(path, 'utf8'));
}

const [, , command, policyPath, requestPath] = process.argv;
if (!command || !policyPath) {
  usage();
  process.exitCode = 1;
} else {
  const policy = await readJson(policyPath);
  const errors = validate(policy);
  if (errors.length) {
    console.error(JSON.stringify({ ok: false, errors }, null, 2));
    process.exitCode = 2;
  } else if (command === 'validate') {
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', policyId: policy.id }, null, 2));
  } else if (command === 'preview' && requestPath) {
    const request = await readJson(requestPath);
    const remaining = policy.maxTotalAmount - policy.spentAmount;
    const allowed =
      policy.enabled === true &&
      request.policyId === policy.id &&
      request.chainId === policy.chainId &&
      String(request.tokenSymbol).toUpperCase() === String(policy.tokenSymbol).toUpperCase() &&
      String(request.recipient).toLowerCase() === String(policy.recipient).toLowerCase() &&
      Number.isFinite(request.amount) &&
      request.amount > 0 &&
      request.amount <= policy.maxAmountPerPayment &&
      request.amount <= remaining;
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry-run',
      allowed,
      reason: allowed ? 'Policy conditions satisfied.' : 'Request is outside policy limits.',
      remainingBeforePayment: remaining,
      remainingAfterPayment: allowed ? remaining - request.amount : remaining,
    }, null, 2));
  } else {
    usage();
    process.exitCode = 1;
  }
}
