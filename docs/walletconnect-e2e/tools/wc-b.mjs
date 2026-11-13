// Suite B: failure paths, a wallet without Arc, and mobile — real app, real Reown relay.
import { launch, newApp, openWalletConnect, getUri, startWallet, panelOf, connectBtn, showsAddress, hasText, stored, ok, info, sleep, summary } from './wc-lib.mjs';

const b = await launch();
const only = process.env.ONLY || 'all';
const want = (n) => only === 'all' || only === n;
const sdkWarnings = (app) => app.logs.filter((l) => /already initialized|Init\(\) was called/i.test(l));

// ── B1. The wallet rejects the pairing; retry on the same page ─────────────────
if (want('reject')) {
  console.log('\n[B1] Pairing rejected in the wallet, then "Try again" on the same page');
  const app = await newApp(b); const { page } = app;
  const panel = await openWalletConnect(page); const uri1 = await getUri(page, panel);
  const w1 = startWallet(uri1, 'reject');
  ok('the wallet receives the proposal and rejects it', !!(await w1.wait(/REJECTED|reject/i, 40000)));
  ok('the panel says the connection was rejected', await panel.getByText(/rejected in the wallet/i).waitFor({ state: 'visible', timeout: 25000 }).then(() => true).catch(() => false));
  const retry = panel.getByRole('button', { name: /Try again/i });
  ok('a "Try again" button is offered', await retry.isVisible().catch(() => false));
  ok('nothing got connected', await connectBtn(page).isVisible().catch(() => false));
  await retry.click();
  const uri2 = await getUri(page, panel);
  ok('"Try again" creates a NEW pairing (different URI)', uri2 !== uri1 && /^wc:/.test(uri2));
  const w2 = startWallet(uri2, 'known-arc');
  await w2.wait(/APPROVED/, 40000);
  ok('after a rejection the same page connects normally', await showsAddress(page, w2.address(), 40000));
  ok('the SDK was not initialised twice in the page', sdkWarnings(app).length === 0, sdkWarnings(app).join(' | ').slice(0, 200));
  w1.stop(); w2.stop(); await app.close();
}

// ── B2. The user closes the window before scanning ─────────────────────────────
if (want('cancel')) {
  console.log('\n[B2] Window closed before scanning');
  const app = await newApp(b); const { page } = app;
  const panel = await openWalletConnect(page); const uri = await getUri(page, panel);
  await panel.getByRole('button', { name: /^Cancel$/ }).first().click();
  ok('the window closes', await panel.waitFor({ state: 'hidden', timeout: 8000 }).then(() => true).catch(() => false));
  ok('NV is still disconnected', await connectBtn(page).isVisible().catch(() => false));
  // a wallet that approves the abandoned pairing afterwards must not leave NV connected without the user knowing
  const late = startWallet(uri, 'known-arc');
  const lateApproved = await late.wait(/APPROVED/, 30000);
  info(`the abandoned pairing was ${lateApproved ? 'still approvable by a wallet' : 'no longer approvable (already closed)'}`);
  await sleep(10000);
  ok('NV still shows no connected wallet (no hidden connection)', await connectBtn(page).isVisible().catch(() => false));
  ok('no session is left in the browser', !(await stored(page)).session);
  if (lateApproved) ok('the late session was closed on the wallet side as well', !!(await late.wait(/SESSION_DELETED/, 20000)));
  const panel2 = await openWalletConnect(page); const uri2 = await getUri(page, panel2);
  const w = startWallet(uri2, 'known-arc'); await w.wait(/APPROVED/, 40000);
  ok('after cancelling, a fresh attempt connects normally', await showsAddress(page, w.address(), 40000));
  ok('the SDK was not initialised twice in the page', sdkWarnings(app).length === 0, sdkWarnings(app).join(' | ').slice(0, 200));
  late.stop(); w.stop(); await app.close();
}

// ── B3. A wallet that does NOT know Arc: what happens when NV asks to switch? ──
if (want('noarc')) {
  console.log('\n[B3] Wallet without Arc configured');
  const app = await newApp(b); const { page } = app;
  const panel = await openWalletConnect(page); const uri = await getUri(page, panel);
  const w = startWallet(uri, 'no-arc');
  const appr = await w.wait(/APPROVED/, 40000);
  ok('the wallet approves a session WITHOUT Arc (it does not know it)', !!appr && !/5042/.test(appr), appr ?? '');
  ok('NV still connects', await showsAddress(page, w.address(), 40000));
  await sleep(2500);
  const sw = page.getByRole('button', { name: /Switch to/i }).first();
  ok('NV shows the "Switch to ..." button (the wallet is not on the NV network)', await sw.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false));
  const before = w.lines.filter((l) => /REQUEST/.test(l)).length;
  for (const n of [1, 2]) {
    await sw.click();
    ok(`attempt ${n}: NV explains that the wallet did not approve this network for the connection`, await hasText(page, /did not approve this network/i, 15000));
    await sleep(3000);
    ok(`attempt ${n}: NV is still connected (the session is not dropped)`, await showsAddress(page, w.address(), 4000) && !(await connectBtn(page).isVisible().catch(() => false)));
    ok(`attempt ${n}: the mismatch banner is still shown (NV never claims Arc)`, await sw.isVisible().catch(() => false));
  }
  ok('NV did not send the wallet any switch/add request for a network outside the session', w.lines.filter((l) => /REQUEST/.test(l)).length === before, JSON.stringify(w.lines.filter((l) => /REQUEST/.test(l)).slice(before)));
  info('RESULT for wallets without Arc: NV explains it, stays connected, and the user adds the network in the wallet and connects again');
  ok('the SDK was not initialised twice in the page', sdkWarnings(app).length === 0, sdkWarnings(app).join(' | ').slice(0, 200));
  w.stop(); await app.close();
}

// ── B4. Mobile browser: deep link and layout ───────────────────────────────────
if (want('mobile')) {
  console.log('\n[B4] Mobile browser');
  const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const app = await newApp(b, { viewport: { width: 390, height: 844 }, userAgent: UA, isMobile: true, hasTouch: true }); const { page } = app;
  // phones use the hamburger; open the wallet picker from the visible Connect button
  const connect = connectBtn(page);
  ok('the Connect button is reachable on a phone', await connect.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false));
  await connect.tap().catch(() => connect.click());
  await page.locator('[data-testid=wallet-option-walletconnect]').click();
  const panel = panelOf(page); await panel.waitFor({ state: 'visible' });
  const uri = await getUri(page, panel);
  const link = panel.getByRole('link', { name: /Open in wallet/i });
  ok('"Open in wallet" (deep link) is offered on a phone', await link.isVisible().catch(() => false));
  const href = await link.getAttribute('href').catch(() => null);
  ok('the deep link is the pairing URI itself (wc: scheme)', !!href && href === uri && href.startsWith('wc:'), (href ?? '').slice(0, 40));
  const box = await panel.boundingBox(); const vw = 390;
  ok('the window fits the phone screen', !!box && box.x >= 0 && box.x + box.width <= vw + 1 && box.width > 280, JSON.stringify(box && { x: Math.round(box.x), w: Math.round(box.width) }));
  ok('no horizontal scrolling', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await sleep(2600); // the copy done by getUri() relabels the button "Link copied" for ~2 s
  ok('"Copy link" is also available', await panel.getByRole('button', { name: /Copy link/i }).isVisible());
  // desktop must NOT show the deep link (it does nothing there)
  await app.close();
  const d = await newApp(b); const dp = await openWalletConnect(d.page); await getUri(d.page, dp);
  ok('desktop does not show the phone-only deep link', (await dp.getByRole('link', { name: /Open in wallet/i }).count()) === 0);
  await d.close();
}

await b.close();
summary();
