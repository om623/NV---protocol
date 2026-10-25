/**
 * NV Protocol — Autonomous Payment Policy CRE workflow (dry-run).
 * Evaluates a pre-authorized payment request. It never signs or broadcasts a transaction.
 */
import { CronCapability, handler, type Runtime } from '@chainlink/cre-sdk';
import { z } from 'zod';

const configSchema = z.object({
  schedule: z.string(),
  environment: z.literal('testnet'),
  chainId: z.number().int().positive(),
  tokenSymbol: z.string().min(1),
  recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  maxAmountPerPayment: z.number().positive(),
  maxTotalAmount: z.number().positive(),
  requestedAmount: z.number().positive(),
});

type Config = z.infer<typeof configSchema>;
interface PolicyReport {
  allowed: boolean;
  chainId: number;
  tokenSymbol: string;
  recipient: string;
  requestedAmount: number;
  reason: string;
  evaluatedAtMs: number;
  dryRun: boolean;
}

const cron = new CronCapability();
const paymentPolicyHandler = handler(
  cron.trigger({ schedule: '*/5 * * * *' }),
  (runtime: Runtime<Config>): PolicyReport => {
    const c = runtime.config;
    const allowed =
      c.environment === 'testnet' &&
      c.requestedAmount <= c.maxAmountPerPayment &&
      c.requestedAmount <= c.maxTotalAmount;
    return {
      allowed,
      chainId: c.chainId,
      tokenSymbol: c.tokenSymbol,
      recipient: c.recipient,
      requestedAmount: c.requestedAmount,
      reason: allowed ? 'Policy conditions satisfied.' : 'Policy limit exceeded.',
      evaluatedAtMs: runtime.now().getTime(),
      dryRun: true,
    };
  },
);
export default [paymentPolicyHandler];
export { configSchema };
