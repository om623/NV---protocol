-- Update the authoritative server-side catalog to match the Profile shop.
-- Product IDs and XP quantities remain unchanged so existing entitlements stay valid.
UPDATE public.gamification_products
SET price_usd = CASE id
  WHEN 'premium-500' THEN 10
  WHEN 'premium-1000' THEN 20
  WHEN 'xp-daily' THEN 0.2
  WHEN 'xp-weekly' THEN 0.5
  WHEN 'xp-quarterly' THEN 1
  ELSE price_usd
END,
updated_at = now()
WHERE id IN ('premium-500', 'premium-1000', 'xp-daily', 'xp-weekly', 'xp-quarterly');
