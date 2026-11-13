import { launch, newApp, openWalletConnect, getUri, startWallet, showsAddress, connectBtn, sleep, panelOf } from './wc-lib.mjs';
const OUT = '/home/user/app/docs/walletconnect-e2e/screenshots';
const b = await launch();
// 1-3 desktop: picker, QR, connected
let app = await newApp(b); let page = app.page;
await connectBtn(page).click(); await sleep(1200);
await page.screenshot({ path: `${OUT}/01-desktop-picker.png` });
await page.locator('[data-testid=wallet-option-walletconnect]').click();
const panel = panelOf(page); await panel.waitFor({ state: 'visible' });
const uri = await getUri(page, panel); await sleep(2600);
await page.screenshot({ path: `${OUT}/02-desktop-qr.png` });
const w = startWallet(uri, 'known-arc'); await w.wait(/APPROVED/, 50000); await showsAddress(page, w.address(), 40000); await sleep(2500);
await page.screenshot({ path: `${OUT}/03-desktop-connected.png` });
w.stop(); await app.close();
// 4 mobile
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
app = await newApp(b, { viewport: { width: 390, height: 844 }, userAgent: UA, isMobile: true, hasTouch: true }); page = app.page;
await connectBtn(page).tap().catch(() => connectBtn(page).click());
await page.locator('[data-testid=wallet-option-walletconnect]').click();
const mp = panelOf(page); await mp.waitFor({ state: 'visible' }); await getUri(page, mp); await sleep(2800);
await page.screenshot({ path: `${OUT}/04-mobile-qr-and-deeplink.png` });
await app.close();
// 5 wallet without Arc: explained, still connected
app = await newApp(b); page = app.page;
const p5 = await openWalletConnect(page); const u5 = await getUri(page, p5);
const w5 = startWallet(u5, 'no-arc'); await w5.wait(/APPROVED/, 50000); await showsAddress(page, w5.address(), 40000); await sleep(3000);
await page.getByRole('button', { name: /Switch to/i }).first().click(); await sleep(1800);
await page.screenshot({ path: `${OUT}/05-wallet-without-arc-explained.png` });
w5.stop(); await app.close(); await b.close();
console.log('done');
