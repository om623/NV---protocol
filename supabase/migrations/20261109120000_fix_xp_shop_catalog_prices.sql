-- Keep the authoritative XP product catalog aligned with the Profile shop.
-- The UI charges $0.20 / $0.50 / $1.00 for 30 / 60 / 300 XP.
-- Earlier seed data used $10 / $25 / $100, which makes verify-purchase
-- reject correctly submitted payments with an amount mismatch.
UPDATE public.gamification_products
SET
  price_usd = CASE id
    WHEN 'xp-daily' THEN 0.20
    WHEN 'xp-weekly' THEN 0.50
    WHEN 'xp-quarterly' THEN 1.00
    ELSE price_usd
  END,
  xp_amount = CASE id
    WHEN 'xp-daily' THEN 30
    WHEN 'xp-weekly' THEN 60
    WHEN 'xp-quarterly' THEN 300
    ELSE xp_amount
  END,
  product_type = 'xp',
  is_active = true,
  updated_at = now()
WHERE id IN ('xp-daily', 'xp-weekly', 'xp-quarterly');
