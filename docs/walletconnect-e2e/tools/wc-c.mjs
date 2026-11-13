// Suite C: injected wallets (MetaMask/Phantom style, EIP-6963) must behave exactly as before.
import { launch, newApp, connectBtn, ok, sleep, hasText, summary } from './wc-lib.mjs';
const ADDR = '0x1111111111111111111111111111111111111111';

// Runs inside the page before any app script: announces a fake EIP-1193 wallet the same way MetaMask does (EIP-6963).
const injected = ({ ADDR }) => {
  const listeners = {}; const calls = []; let chain = '0x1'; const known = new Set(['0x1']);
  const emit = (e, ...a) => (listeners[e] ?? []).forEach((h) => h(...a));
  const provider = {
    request: async ({ method, params }) => {
      calls.push(method);
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [ADDR];
      if (method === 'eth_chainId') return chain;
      if (method === 'wallet_switchEthereumChain') { const c = params[0].chainId; if (!known.has(c)) { const e = new Error('Unrecognized chain'); e.code = 4902; throw e; } chain = c; emit('chainChanged', c); return null; }
      if (method === 'wallet_addEthereumChain') { const c = params[0].chainId; known.add(c); chain = c; emit('chainChanged', c); return null; }
      return '0x0';
    },
    on: (e, h) => { (listeners[e] ??= []).push(h); },
    removeListener: (e, h) => { listeners[e] = (listeners[e] ?? []).filter((x) => x !== h); },
  };
  window.__fakeCalls = calls;
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info: { uuid: 'fake-1', name: 'Fake Injected Wallet', icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=', rdns: 'test.fake.injected' }, provider }) }));
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
};

const b = await launch();
const app = await newApp(b, { init: { fn: injected, arg: { ADDR } } });
const { page } = app;

console.log('\n[C1] Injected wallet flow (unchanged by the WalletConnect work)');
await connectBtn(page).click();
ok('the picker lists the injected wallet', await page.getByText('Fake Injected Wallet').first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false));
ok('and the WalletConnect option next to it', await page.locator('[data-testid=wallet-option-walletconnect]').isVisible());
await page.getByText('Fake Injected Wallet').first().click();
ok('connecting shows the injected wallet address', await page.locator('button', { hasText: /0x1111/i }).first().waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false));
ok('NV says the wallet connected', await hasText(page, /Wallet connected/, 8000));
const sw = page.getByRole('button', { name: /Switch to/i }).first();
ok('the wallet is on Ethereum and NV on another network -> "Switch to ..." shown', await sw.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false));
await sw.click(); await sleep(6000);
const calls = await page.evaluate(() => window.__fakeCalls);
ok('NV switches through the standard flow (switch, then add the unknown network)', calls.includes('wallet_switchEthereumChain') && calls.includes('wallet_addEthereumChain'), calls.filter((c) => c.startsWith('wallet_')).join(','));
ok('the mismatch banner clears for an injected wallet', !(await sw.isVisible().catch(() => false)));
await page.locator('button', { hasText: /0x1111/i }).first().click();
await page.getByRole('button', { name: /Disconnect/ }).first().click();
ok('Disconnect works for an injected wallet', await connectBtn(page).waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false));
ok('no WalletConnect session was created or touched', await page.evaluate(async () => !((await indexedDB.databases?.()) ?? []).some((d) => d.name === 'WALLET_CONNECT_V2_INDEXED_DB')));
ok('no unexpected JS errors', app.errors.length === 0, app.errors.join(' | '));
await app.close(); await b.close(); summary();
