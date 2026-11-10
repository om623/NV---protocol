-- Route NV Shop payments to Arc Mainnet.
-- Arc Mainnet: chain ID 5042; native USDC is transferred with 18 decimals.
-- The token_address is intentionally empty because the shop sends native USDC,
-- not an ERC-20 transfer. The ERC-20 USDC representation is not used here.

INSERT INTO public.payment_config (key, value, updated_at)
VALUES
  ('chain_id', '5042', now()),
  ('min_confirmations', '1', now()),
  ('payment_wallet', '0xAd397122941D03450c70d0076379e079334D434f', now()),
  ('token_address', '', now()),
  ('token_decimals', '18', now()),
  ('token_symbol', 'USDC', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();

-- Purchase and entitlement writes must be performed only by the Edge Function
-- using the Supabase service/secret key. The public client retains read access.
DROP POLICY IF EXISTS "anon_insert_purchases" ON public.gamification_purchases;
DROP POLICY IF EXISTS "anon_update_purchases" ON public.gamification_purchases;
DROP POLICY IF EXISTS "anon_insert_entitlements" ON public.gamification_entitlements;
DROP POLICY IF EXISTS "anon_delete_entitlements" ON public.gamification_entitlements;
