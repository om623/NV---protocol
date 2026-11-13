// Production build (vite preview): the SDK must talk to the Reown relay DIRECTLY (no /wc-relay), and a policy that blocks it is detected.
import { spawn } from 'node:child_process';
import { launch, ok, info, sleep, startWallet, showsAddress, connectBtn, panelOf, getUri, summary } from './wc-lib.mjs';
const PROD = 'http://127.0.0.1:4173';
const CSP_SELF = "frame-ancestors https://studio.arc.io; connect-src 'self'";
const b = await launch();
const mkCtx = async () => {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('nv_splash_seen', '1'); localStorage.setItem('nv-locale', 'en'); } catch {} document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'div[class*="will-change-transform"][class*="pointer-events-none"].fixed{display:none!important}'; document.head.appendChild(s); }); });
  return ctx;
};
const open = async (page) => { await connectBtn(page).click(); await page.locator('[data-testid=wallet-option-walletconnect]').click(); const p = panelOf(page); await p.waitFor({ state: 'visible' }); return p; };

console.log('\n[P1] PRODUCTION build: direct relay, QR and a full pairing');
{
  const ctx = await mkCtx(); const page = await ctx.newPage(); const hosts = [];
  page.on('websocket', (w) => { const u = new URL(w.url()); hosts.push(u.host + u.pathname); });
  await page.goto(PROD + '/'); await sleep(6500);
  const panel = await open(page); const t0 = Date.now();
  const qr = await panel.locator('img[alt="WalletConnect QR Code"]').waitFor({ state: 'visible', timeout: 60000 }).then(() => true).catch(() => false);
  ok('the QR Code appears in the production build', qr, qr ? `${((Date.now() - t0) / 1000).toFixed(1)} s` : '');
  ok('the SDK opened a socket DIRECTLY to relay.walletconnect.org', hosts.some((h) => h.startsWith('relay.walletconnect.org')), hosts.filter((h) => /relay/.test(h)).slice(0, 2).join(','));
  ok('and never to the /wc-relay proxy path', !hosts.some((h) => h.includes('/wc-relay')));
  const uri = await getUri(page, panel); const w = startWallet(uri, 'known-arc');
  ok('a wallet pairs over the real relay and approves', !!(await w.wait(/APPROVED/, 60000)));
  ok('NV shows the connected wallet', await showsAddress(page, w.address(), 40000));
  await page.screenshot({ path: '/home/user/app/docs/walletconnect-e2e/screenshots/08-production-build-direct-relay.png' });
  w.stop(); await ctx.close();
}

console.log('\n[P2] PRODUCTION build behind the Preview policy: not used there, but the block is detected at once and named');
{
  const edge = spawn('node', ['/tmp/pw/edge.cjs'], { env: { ...process.env, EDGE_PORT: '5181', EDGE_TARGET: '4173' }, stdio: 'ignore' }); await sleep(1200);
  const ctx = await mkCtx(); const page = await ctx.newPage(); const hosts = [];
  page.on('websocket', (w) => { const u = new URL(w.url()); hosts.push(u.host + u.pathname); });
  const resp = await page.goto('http://127.0.0.1:5181/'); await sleep(6500);
  ok('the page carries the Preview policy (connect-src \'self\')', /connect-src 'self'/.test(resp.headers()['content-security-policy'] ?? ''));
  const panel = await open(page); const t0 = Date.now();
  const shown = await panel.getByText(/security policy is blocking/i).waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  ok('the production build names the cause (security policy) within seconds', shown, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
  ok('"Try again" is offered and the spinner is gone', (await panel.getByRole('button', { name: /Try again/i }).isVisible()) && (await panel.getByText(/Preparing connection/i).count()) === 0);
  ok('production did not try the dev proxy path', !hosts.some((h) => h.includes('/wc-relay')));
  await page.screenshot({ path: '/home/user/app/docs/walletconnect-e2e/screenshots/09-production-blocked-by-policy-message.png' });
  await ctx.close(); edge.kill('SIGKILL');
}
await b.close(); summary();
