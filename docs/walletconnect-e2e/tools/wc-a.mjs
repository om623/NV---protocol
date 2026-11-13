// Suite A: full session lifecycle against the REAL app and the REAL Reown relay.
import { launch, newApp, openWalletConnect, getUri, startWallet, panelOf, connectBtn, showsAddress, hasText, stored, ok, info, sleep, summary } from './wc-lib.mjs';

const b = await launch();
console.log('\n[A1] Panel, QR Code, pairing URI and Project ID');
const app = await newApp(b); const { page } = app;
const panel = await openWalletConnect(page);
ok('the picker lists WalletConnect and its panel opens', await panel.isVisible());
ok('Project ID is loaded: the panel does not say "not configured"', (await panel.getByText(/Project ID is not configured/).count()) === 0);
const uri = await getUri(page, panel); // waits for the QR: the relay accepted the Project ID
ok('QR Code appears (the Reown relay accepted the Project ID)', await panel.locator('img[alt="WalletConnect QR Code"]').isVisible());
const src = await panel.locator('img[alt="WalletConnect QR Code"]').getAttribute('src');
ok('the QR is a real image', /^data:image\/png;base64,/.test(src ?? '') && (src ?? '').length > 2000, `${(src ?? '').length} chars`);
ok('the pairing URI has the WalletConnect v2 shape', /^wc:[0-9a-f]{64}@2\?/.test(uri) && /relay-protocol=irn/.test(uri) && /symKey=[0-9a-f]{64}/.test(uri), uri.slice(0, 24) + '...');
ok('the QR is not full-screen (the page stays usable behind it)', await (async () => { const r = await panel.boundingBox(); return !!r && r.width < 400 && r.height < 600; })());

console.log('\n[A2] Wallet approves the pairing');
const w = startWallet(uri, 'known-arc');
const prop = await w.wait(/PROPOSAL/, 45000);
ok('the wallet received the proposal through the relay', !!prop, prop ?? '');
info(`proposal as sent by the SDK: ${(prop ?? '').replace(/^\[wallet [^\]]*\]\s*/, '')}`);
const optionalN = Number((prop ?? '').match(/optional=(\d+)/)?.[1] ?? 0);
ok(`session offers the other NV networks as optional (${optionalN})`, optionalN >= 25);
ok('Arc and Arc Testnet are among the requested networks', /arcAsked=true/.test(prop ?? ''));
const appr = await w.wait(/APPROVED/, 30000);
ok('the wallet approved the session', !!appr, appr ?? '');
ok('the approved session includes Arc (5042) and Arc Testnet (5042002)', /5042002/.test(appr ?? '') && /eip155:5042(,|$)/.test(appr ?? ''));
const addr = w.address();
ok('NV shows the connected wallet address', await showsAddress(page, addr), addr);
ok('the pairing window closed after connecting', await panelOf(page).waitFor({ state: 'hidden', timeout: 8000 }).then(() => true).catch(() => false));
ok('NV says the wallet connected', await hasText(page, /Wallet connected/));
ok('the session is persisted in the browser (for reconnection)', (await stored(page)).session);
ok('Connect button gone, account menu shown', !(await connectBtn(page).isVisible().catch(() => false)));

console.log('\n[A3] Network: wallet-side change, then switch back to the NV network (Arc Testnet)');
const sw = page.getByRole('button', { name: /Switch to/i }).first();
info(`mismatch banner right after connecting: ${await sw.isVisible().catch(() => false)} (the session starts on the first network the wallet approved)`);
w.cmd('chain 11155111');
ok('the wallet changes network by itself -> NV notices', await hasText(page, /Network changed in wallet/, 25000));
ok('NV shows the "Switch to ..." button because the networks now differ', await sw.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false));
const reqBefore = w.count(/REQUEST/);
await sw.click(); await sleep(6000);
ok('switching to the NV network (Arc Testnet, approved in the session) clears the mismatch', !(await sw.isVisible().catch(() => false)));
ok('the switch needed no extra question to the wallet (chain already approved)', w.count(/REQUEST wallet_switchEthereumChain/) === 0, `wallet requests during the switch: ${w.count(/REQUEST/) - reqBefore}`);

console.log('\n[A4] Reconnection after reload');
const proposalsBefore = w.count(/PROPOSAL/);
await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(2000);
ok('the session is restored: address shown again after the reload', await showsAddress(page, addr, 45000));
ok('restored without asking the wallet again (no new proposal)', w.count(/PROPOSAL/) === proposalsBefore, `proposals ${proposalsBefore} -> ${w.count(/PROPOSAL/)}`);
ok('no pairing window was shown for the restore', !(await panelOf(page).isVisible().catch(() => false)));
ok('NV says the session was restored', await hasText(page, /WalletConnect session restored/, 15000));

console.log('\n[A5] Disconnect from NV');
await page.locator('button', { hasText: /0x[0-9a-f]{4}/i }).first().click();
await page.getByRole('button', { name: /^Disconnect$/ }).click();
ok('NV clears the address and shows Connect again', await connectBtn(page).isVisible({ timeout: 10000 }).catch(() => false));
ok('the wallet is told the session ended', !!(await w.wait(/SESSION_DELETED/, 30000)));
await sleep(1500);
ok('no session is left in the browser', !(await stored(page)).session);
w.stop();

console.log('\n[A6] The wallet ends the session by itself');
const p2 = await openWalletConnect(page); const uri2 = await getUri(page, p2);
const w2 = startWallet(uri2, 'known-arc'); await w2.wait(/APPROVED/, 60000);
ok('reconnects with a fresh pairing', await showsAddress(page, w2.address(), 45000));
w2.cmd('disconnect');
ok('NV warns that the connection was interrupted', await hasText(page, /connection was interrupted/, 30000));
ok('NV goes back to disconnected', await connectBtn(page).isVisible({ timeout: 15000 }).catch(() => false));
ok('no session is left in the browser', !(await stored(page)).session);
w2.stop();

info('SDK console messages worth reading: ' + (app.logs.filter((l) => /already initialized|No matching key|failed to process|Pending session/i.test(l)).map((l) => l.slice(0, 150)).join(' || ') || 'none'));
ok('no unexpected JS errors in the app', app.errors.length === 0, app.errors.join(' | '));
await app.close(); await b.close(); summary();
