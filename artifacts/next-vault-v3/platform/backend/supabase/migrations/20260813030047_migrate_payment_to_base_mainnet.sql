-- Migrate payment config from Arc Testnet to Base Mainnet + official USDC
-- Official USDC on Base Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (6 decimals)
-- Source: Circle official docs / basescan.org

UPDATE payment_config SET value = '8453', updated_at = now() WHERE key = 'chain_id';
UPDATE payment_config SET value = '6', updated_at = now() WHERE key = 'token_decimals';
UPDATE payment_config SET value = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', updated_at = now() WHERE key = 'token_address';
UPDATE payment_config SET value = 'USDC', updated_at = now() WHERE key = 'token_symbol';
