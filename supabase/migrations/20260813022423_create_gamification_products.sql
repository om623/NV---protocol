/*
# Gamification Products — Server-side authoritative product catalog

## Purpose
Single source of truth for product pricing and configuration.
Both the edge function (for payment validation) and the frontend (for display)
read from this table. Only the server-side edge function uses these prices
for payment verification — the frontend never defines the accepted price.

## Table: gamification_products
- id (text, PK) — product identifier (e.g. 'xp-daily', 'premium-500')
- product_type (text) — 'skin' or 'xp'
- price_usd (numeric) — authoritative price in USD
- xp_amount (numeric) — XP granted (0 for skins)
- is_active (boolean) — soft-disable a product without deleting it
- created_at / updated_at — timestamps

## Security
- RLS enabled, TO anon, authenticated — anyone can read (needed for display)
- No insert/update/delete from the anon key — only service role can modify
  (the edge function uses the service role key)
*/

CREATE TABLE IF NOT EXISTS gamification_products (
  id text PRIMARY KEY,
  product_type text NOT NULL CHECK (product_type IN ('skin', 'xp')),
  price_usd numeric NOT NULL,
  xp_amount numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gamification_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_products" ON gamification_products;
CREATE POLICY "anon_read_products"
  ON gamification_products FOR SELECT
  TO anon, authenticated USING (true);

-- No INSERT/UPDATE/DELETE policies — only service role can modify.

-- Seed current products (preserving existing prices)
INSERT INTO gamification_products (id, product_type, price_usd, xp_amount, is_active) VALUES
  ('xp-daily',      'xp',   10,   30,  true),
  ('xp-weekly',     'xp',   25,   60,  true),
  ('xp-quarterly',  'xp',  100,  300,  true),
  ('premium-500',   'skin', 500,   0,  true),
  ('premium-1000',  'skin',1000,   0,  true)
ON CONFLICT (id) DO UPDATE SET
  price_usd = EXCLUDED.price_usd,
  xp_amount = EXCLUDED.xp_amount,
  product_type = EXCLUDED.product_type,
  is_active = EXCLUDED.is_active,
  updated_at = now();
