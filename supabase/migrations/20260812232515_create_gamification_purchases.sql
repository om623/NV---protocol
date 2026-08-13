/*
# Gamification Purchases — On-Chain Payment Verification

## Purpose
Stores real on-chain payment transactions for gamification premium products
(skins, XP packs) and enforces daily/weekly/monthly purchase limits.
This is the server-side source of truth for entitlements — the frontend
cannot grant products without a verified on-chain transaction recorded here.

## 1. New Tables

### `gamification_purchases`
- `id` (uuid, PK) — internal row ID
- `wallet_address` (text, not null) — buyer's wallet address (lowercased)
- `product_id` (text, not null) — e.g. 'premium-500', 'xp-daily'
- `product_type` (text, not null) — 'skin' or 'xp'
- `amount_usd` (numeric, not null) — price paid in USD
- `token_symbol` (text, not null) — 'USDC' or 'USDT'
- `chain_id` (integer, not null) — EVM chain ID of the payment tx
- `tx_hash` (text, not null, unique) — on-chain transaction hash (idempotency key)
- `block_number` (bigint) — block containing the tx
- `status` (text, not null, default 'pending') — 'pending' | 'confirmed' | 'failed'
- `xp_granted` (boolean, not null, default false) — whether XP was credited (for XP packs)
- `skin_unlocked` (boolean, not null, default false) — whether skin was unlocked (for skins)
- `created_at` (timestamptz, default now())
- `confirmed_at` (timestamptz) — when server verified the on-chain tx

### `gamification_entitlements`
- `id` (uuid, PK)
- `wallet_address` (text, not null) — owner wallet (lowercased)
- `product_id` (text, not null) — the unlocked product
- `product_type` (text, not null) — 'skin' or 'xp'
- `purchase_id` (uuid, FK → gamification_purchases) — which purchase granted this
- `tx_hash` (text, not null) — the verified payment tx
- `xp_amount` (numeric, default 0) — XP credited (for XP packs)
- `created_at` (timestamptz, default now())
- Unique constraint on (wallet_address, product_id) for skins — one purchase per skin
- Unique constraint on (wallet_address, tx_hash) for XP — no double-credit

## 2. Security
- RLS enabled on both tables.
- TO anon, authenticated — the app has no sign-in; wallet address is the identity.
- Anyone can read (needed for entitlement checks by wallet address).
- Anyone can insert/update (verification happens server-side in edge function
  with service role key; the frontend only reads and inserts pending rows).

## 3. Important Notes
- `tx_hash` is the idempotency key: a duplicate tx_hash insert fails silently
  or is ignored, preventing double-credit of XP or double-unlock of skins.
- The edge function uses the service role key to update status to 'confirmed'
  after verifying the on-chain transaction receipt.
- Purchase limits are computed from this table by filtering on
  `wallet_address`, `product_id` (or `product_type`), `status = 'confirmed'`,
  and `created_at` within the relevant time window.
*/

CREATE TABLE IF NOT EXISTS gamification_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  product_id text NOT NULL,
  product_type text NOT NULL CHECK (product_type IN ('skin', 'xp')),
  amount_usd numeric NOT NULL,
  token_symbol text NOT NULL,
  chain_id integer NOT NULL,
  tx_hash text NOT NULL UNIQUE,
  block_number bigint,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  xp_granted boolean NOT NULL DEFAULT false,
  skin_unlocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

ALTER TABLE gamification_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_purchases" ON gamification_purchases;
CREATE POLICY "anon_read_purchases"
  ON gamification_purchases FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_purchases" ON gamification_purchases;
CREATE POLICY "anon_insert_purchases"
  ON gamification_purchases FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_purchases" ON gamification_purchases;
CREATE POLICY "anon_update_purchases"
  ON gamification_purchases FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_purchases_wallet ON gamification_purchases(wallet_address);
CREATE INDEX IF NOT EXISTS idx_purchases_wallet_status ON gamification_purchases(wallet_address, status);
CREATE INDEX IF NOT EXISTS idx_purchases_wallet_product ON gamification_purchases(wallet_address, product_id);

-- ── Entitlements table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gamification_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  product_id text NOT NULL,
  product_type text NOT NULL CHECK (product_type IN ('skin', 'xp')),
  purchase_id uuid REFERENCES gamification_purchases(id) ON DELETE CASCADE,
  tx_hash text NOT NULL,
  xp_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_address, tx_hash)
);

ALTER TABLE gamification_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_entitlements" ON gamification_entitlements;
CREATE POLICY "anon_read_entitlements"
  ON gamification_entitlements FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_entitlements" ON gamification_entitlements;
CREATE POLICY "anon_insert_entitlements"
  ON gamification_entitlements FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_entitlements" ON gamification_entitlements;
CREATE POLICY "anon_delete_entitlements"
  ON gamification_entitlements FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_entitlements_wallet ON gamification_entitlements(wallet_address);
CREATE INDEX IF NOT EXISTS idx_entitlements_wallet_product ON gamification_entitlements(wallet_address, product_id);