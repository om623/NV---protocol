// Suite D: the Arc Studio Preview, simulated as faithfully as the sandbox allows.
//  - page origin = https://ilrp5flktwbxr95jfmtwh.preview.studio.arc.io (the real Preview host name, so the browser sends that Origin)
//  - HTML/JS served by the real Vite dev server, with the policy the Preview host sends: connect-src 'self'
//  - the SDK's WebSocket goes to wss://<preview host>/wc-relay, is carried by this "edge" to the REAL Vite dev server (/wc-relay proxy)
//    and from there to the REAL Reown relay, with the same Project ID. Not simulated: Arc Studio's own edge (it answers 403 outside Studio).
import { createRequire } from 'node:module';
import { launch, ok, info, sleep, startWallet, showsAddress, connectBtn, panelOf, getUri, summary } from './wc-lib.mjs';
const require = createRequire(import.meta.url);
const WS = require('/tmp/wcwallet/node_modules/ws');
export const PREV = 'https://ilrp5flktwbxr95jfmtwh.preview.studio.arc.io';
const LOCAL = 'http://127.0.0.1:5173';
export const CSP_SELF = "frame-ancestors https://studio.arc.io; connect-src 'self'";

// mode: 'healthy' = carry the socket to Vite | 'refuse' = close it at once (relay unreachable)
export async function previewEdge(browser, { csp = CSP_SELF, mode = { v: 'healthy' } } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem('nv_splash_seen', '1'); localStorage.setItem('nv-locale', 'en'); } catch {}
    window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.blockedURI));
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'div[class*="will-change-transform"][class*="pointer-events-none"].fixed{display:none!important}'; document.head.appendChild(s); });
  });
  await ctx.route(PREV + '/**', async (route) => {
    const u = new URL(route.request().url());
    const r = await route.fetch({ url: LOCAL + u.pathname + u.search });
    await route.fulfill({ response: r, headers: { ...r.headers(), 'content-security-policy': csp } });
  });
  const page = await ctx.newPage();
  const edge = { wsPaths: [], opened: [], logs: [], page, ctx };
  page.on('websocket', (w) => edge.opened.push(new URL(w.url()).host + new URL(w.url()).pathname));
  page.on('console', (m) => { const t = m.text(); if (/Init\(\) was called|No matching key|already initialized/i.test(t)) edge.logs.push(t.slice(0, 160)); });
  await page.routeWebSocket(/^wss:\/\/ilrp5flktwbxr95jfmtwh\.preview\.studio\.arc\.io\/wc-relay/, (ws) => {
    const u = new URL(ws.url()); edge.wsPaths.push(u.pathname);
    if (mode.v === 'refuse') { ws.close({ code: 1011, reason: 'edge: refused' }); return; }
    const up = new WS('ws://127.0.0.1:5173' + u.pathname + u.search, { headers: { Origin: PREV } });
    const queue = []; up.on('open', () => queue.splice(0).forEach((m) => up.send(m)));
    ws.onMessage((m) => (up.readyState === 1 ? up.send(m) : queue.push(m)));
    up.on('message', (d, bin) => ws.send(bin ? d : d.toString()));
    up.on('close', (c) => { try { ws.close({ code: c && c >= 1000 && c < 5000 ? c : 1000 }); } catch {} });
    ws.onClose(() => { try { up.close(); } catch {} });
    up.on('unexpected-response', () => { try { ws.close({ code: 1011, reason: 'upstream refused' }); } catch {} });
    up.on('error', () => { try { ws.close({ code: 1011 }); } catch {} });
  });
  await page.goto(PREV + '/'); await sleep(6500);
  return edge;
}
export const openWc = async (page) => {
  await connectBtn(page).click();
  await page.locator('[data-testid=wallet-option-walletconnect]').click();
  const panel = panelOf(page); await panel.waitFor({ state: 'visible' }); return panel;
};
const only = process.env.ONLY ?? 'all';
if (process.argv[1].endsWith('wc-d.mjs')) {
  const b = await launch();
  if (only === 'all' || only === 'proof') {
    console.log('\n[D1] Preview-like page (Preview origin + connect-src \'self\'): QR and a full pairing through /wc-relay');
    const e = await previewEdge(b); const { page } = e;
    ok('the page really runs under the Preview origin', (await page.evaluate(() => location.origin)) === PREV);
    const panel = await openWc(page);
    const t0 = Date.now();
    const qr = await panel.locator('img[alt="WalletConnect QR Code"]').waitFor({ state: 'visible', timeout: 60000 }).then(() => true).catch(() => false);
    ok('THE QR CODE APPEARS under the Preview policy', qr, qr ? `${((Date.now() - t0) / 1000).toFixed(1)} s` : (await panel.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 90));
    await page.screenshot({ path: '/home/user/app/docs/walletconnect-e2e/screenshots/06-preview-sim-qr-under-csp.png' });
    ok('the SDK connected through the same-origin path /wc-relay', e.wsPaths.includes('/wc-relay'), e.wsPaths.join(','));
    ok('and never opened a direct WebSocket to relay.walletconnect.org', !e.opened.some((h) => /relay\.walletconnect/.test(h)), e.opened.join(' | '));
    const csp = await page.evaluate(() => window.__csp);
    ok('no Content Security Policy violation for the relay', !csp.some((u) => /relay\.walletconnect|\/wc-relay/.test(u)));
    info(`(other hosts the policy blocks, ignored by design: ${[...new Set(csp.map((u) => { try { return new URL(u).host; } catch { return u; } }))].slice(0, 5).join(', ')})`);
    const uri = await getUri(page, panel);
    ok('the pairing URI is a valid WalletConnect v2 URI', /^wc:[0-9a-f]{64}@2\?/.test(uri) && /relay-protocol=irn/.test(uri));
    const w = startWallet(uri, 'known-arc');
    ok('a wallet pairs with that QR over the real relay and approves', !!(await w.wait(/APPROVED/, 60000)));
    ok('NV shows the connected wallet', await showsAddress(page, w.address(), 40000));
    ok('the SDK was not initialised twice', e.logs.length === 0, e.logs.join(' | '));
    w.stop(); await e.ctx.close();
  }
  if (only === 'all' || only === 'timeout') {
    console.log('\n[D2] Relay unreachable: a clear timeout message, no endless spinner, and "Try again" recovers');
    const mode = { v: 'refuse' };
    const e = await previewEdge(b, { mode }); const { page } = e;
    const panel = await openWc(page);
    const t0 = Date.now();
    const shown = await panel.getByText(/took too long to start/i).waitFor({ state: 'visible', timeout: 70000 }).then(() => true).catch(() => false);
    ok('after the time limit the panel explains the problem', shown, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
    ok('the spinner text is gone (no endless "Preparing connection...")', (await panel.getByText(/Preparing connection/i).count()) === 0);
    ok('a "Try again" button is offered', await panel.getByRole('button', { name: /Try again/i }).isVisible());
    ok('no QR Code is shown for a pairing that cannot work', (await panel.locator('img[alt="WalletConnect QR Code"]').count()) === 0);
    mode.v = 'healthy';
    await panel.getByRole('button', { name: /Try again/i }).click();
    const t1 = Date.now();
    const qr = await panel.locator('img[alt="WalletConnect QR Code"]').waitFor({ state: 'visible', timeout: 70000 }).then(() => true).catch(() => false);
    ok('once the relay is reachable, "Try again" shows the QR Code', qr, `${((Date.now() - t1) / 1000).toFixed(1)} s`);
    ok('the SDK was not initialised twice', e.logs.length === 0, e.logs.join(' | '));
    await e.ctx.close();
  }
  if (only === 'all' || only === 'csp') {
    console.log('\n[D3] A policy that blocks the relay connection is detected immediately (real WebSocket, no mocking: the policy is really enforced)');
    const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
    await ctx.addInitScript(() => { try { sessionStorage.setItem('nv_splash_seen', '1'); localStorage.setItem('nv-locale', 'en'); } catch {} });
    await ctx.route(LOCAL + '/**', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, headers: { ...r.headers(), 'content-security-policy': "connect-src 'none'" } }); });
    const page = await ctx.newPage(); await page.goto(LOCAL + '/'); await sleep(6500);
    const panel = await openWc(page);
    const t0 = Date.now();
    const shown = await panel.getByText(/security policy is blocking/i).waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
    ok('the panel names the cause (security policy) well before the 20 s and 25 s limits', shown, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
    ok('the spinner is gone', (await panel.getByText(/Preparing connection/i).count()) === 0);
    ok('a "Try again" button is offered', await panel.getByRole('button', { name: /Try again/i }).isVisible());
    ok('the error text never contains the relay auth token', !/auth=|eyJ/.test(await panel.innerText()));
    await ctx.close();
  }
  if (only === 'all' || only === 'real') {
    console.log('\n[D4] REAL WebSocket under the REAL policy connect-src \'self\': a transparent edge server adds the header, nothing is intercepted or mocked');
    const { spawn } = await import('node:child_process');
    const edgeProc = spawn('node', ['/tmp/pw/edge.cjs'], { env: { ...process.env, EDGE_PORT: '5180' }, stdio: 'ignore' });
    await sleep(1200);
    const EDGE = 'http://127.0.0.1:5180';
    const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.addInitScript(() => {
      try { sessionStorage.setItem('nv_splash_seen', '1'); localStorage.setItem('nv-locale', 'en'); } catch {}
      window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.blockedURI));
      document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'div[class*="will-change-transform"][class*="pointer-events-none"].fixed{display:none!important}'; document.head.appendChild(s); });
    });
    const page = await ctx.newPage(); const opened = []; page.on('websocket', (w) => { const u = new URL(w.url()); opened.push(u.host + u.pathname); });
    const resp = await page.goto(EDGE + '/'); await sleep(6500);
    ok('the page really carries the Preview policy header', /connect-src 'self'/.test(resp.headers()['content-security-policy'] ?? ''), resp.headers()['content-security-policy']);
    const panel = await openWc(page);
    const t0 = Date.now();
    const qr = await panel.locator('img[alt="WalletConnect QR Code"]').waitFor({ state: 'visible', timeout: 60000 }).then(() => true).catch(() => false);
    ok('THE QR CODE APPEARS with the policy really enforced', qr, qr ? `${((Date.now() - t0) / 1000).toFixed(1)} s` : (await panel.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 90));
    await page.screenshot({ path: '/home/user/app/docs/walletconnect-e2e/screenshots/07-real-websocket-under-connect-src-self.png' });
    ok('the relay socket is the same-origin /wc-relay (through the edge)', opened.some((h) => h === '127.0.0.1:5180/wc-relay'), opened.filter((h) => /relay/.test(h)).slice(0, 2).join(','));
    ok('no socket was opened to relay.walletconnect.org', !opened.some((h) => /relay\.walletconnect/.test(h)));
    const csp = await page.evaluate(() => window.__csp);
    ok('the policy did not block the relay', !csp.some((u) => /relay\.walletconnect|\/wc-relay/.test(u)));
    info(`(blocked by the policy and ignored by design: ${[...new Set(csp.map((u) => { try { return new URL(u).host; } catch { return u; } }))].slice(0, 4).join(', ')})`);
    const uri = await getUri(page, panel);
    const w = startWallet(uri, 'known-arc');
    ok('a wallet pairs over the real relay and approves', !!(await w.wait(/APPROVED/, 60000)));
    ok('NV shows the connected wallet', await showsAddress(page, w.address(), 40000));
    w.stop(); await ctx.close(); edgeProc.kill('SIGKILL');
  }
  await b.close(); summary();
}
