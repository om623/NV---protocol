-- Route Profile shop purchases to Arc Mainnet native USDC.
-- The official ARC treasury/payment wallet is intentionally left blank until verified.
-- No funds are sent to the previous user wallet; purchases remain disabled meanwhile.

INSERT INTO payment_config (key, value) VALUES
  ('payment_wallet', ''),
  ('beneficiary_name', 'ARC'),
  ('min_confirmations', '1'),
  ('token_symbol', 'USDC'),
  ('token_decimals', '18'),
  ('token_address', ''),
  ('chain_id', '5042')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
