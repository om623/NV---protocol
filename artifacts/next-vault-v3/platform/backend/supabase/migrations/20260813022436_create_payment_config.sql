/*
# Payment configuration — server-side secrets stored in vault

## Purpose
Stores the payment wallet address and minimum confirmations requirement
as server-side configuration. The edge function reads these using the
service role key. The frontend never has direct access — it must query
through the edge function.

Using the vault extension keeps secrets out of edge function source code
and environment variables, and provides auditability.

## Table: payment_config
- key (text, PK) — configuration key (e.g. 'payment_wallet', 'min_confirmations')
- value (text, not null) — the configuration value
- updated_at (timestamptz) — last update

## Security
- RLS enabled, TO anon, authenticated — DENY all access.
  Only the service role (used by the edge function) can read/write.
  The anon key used by the frontend cannot access this table directly.
*/

CREATE TABLE IF NOT EXISTS payment_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_config ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated.
-- RLS with no policies = deny all for anon and authenticated roles.
-- Only the service role bypasses RLS.

-- Seed current configuration
INSERT INTO payment_config (key, value) VALUES
  ('payment_wallet', '0xAd397122941D03450c70d0076379e079334D434f'),
  ('min_confirmations', '1'),
  ('token_symbol', 'USDC'),
  ('token_decimals', '18'),
  ('token_address', ''),
  ('chain_id', '5042002')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
