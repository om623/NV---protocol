// Shared helpers for the WalletConnect end-to-end tests.
// The NV app side is the REAL app in a real browser. The wallet side is a headless test wallet (see /tmp/wcwallet/wallet.mjs)
// that talks to the REAL Reown relay with the same Project ID.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const APP = 'http://127.0.0.1:5173/';
export const PROJECT_ID = 'a88bdd462a69fb89edc408296a75e91d';
export const results = { pass: 0, fail: 0 };
export const ok = (name, cond, extra = '') => { cond ? results.pass++ : results.fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`); };
export const info = (m) => console.log('     ' + m);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const summary = () => { console.log(`\n${results.pass} passed, ${results.fail} failed`); };

export const launch = () => chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const KNOWN_NOISE = /Encountered two children with the same key|isExternalMethodAvailable|compute-pressure|Failed to load resource|Access to fetch|CORS|same key|422|ERR_FAILED|favicon/i;

export async function newApp(browser, o = {}) {
  const ctx = o.ctx ?? (await browser.newContext({
    viewport: o.viewport ?? { width: 1360, height: 900 },
    userAgent: o.userAgent, isMobile: o.isMobile, hasTouch: o.hasTouch,
    permissions: ['clipboard-read', 'clipboard-write'],
  }));
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem('nv_splash_seen', '1'); localStorage.setItem('nv-locale', 'en'); } catch { /* ignore */ }
    // test-only: the host's roaming NV Agent orb can land on the control a test is about to click
    document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'div.fixed[class*="will-change-transform"][class*="pointer-events-none"]{display:none!important}'; document.head.appendChild(st); });
  });
  if (o.init) await ctx.addInitScript(o.init.fn, o.init.arg); // must be registered BEFORE the page exists
  const page = await ctx.newPage();
  const errors = [], logs = [];
  page.on('pageerror', (e) => { if (!KNOWN_NOISE.test(e.message)) errors.push('PAGEERROR ' + e.message.slice(0, 200)); });
  page.on('console', (m) => { const t = m.text(); logs.push(m.type() + ': ' + t.slice(0, 200)); if (m.type() === 'error' && !KNOWN_NOISE.test(t)) errors.push(t.slice(0, 200)); });
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(o.settle ?? 5000);
  return { ctx, page, errors, logs, close: () => ctx.close() };
}

export function startWallet(uri, mode = 'known-arc') {
  const dir = fs.mkdtempSync('/tmp/wcwallet/run-');
  const proc = spawn('node', ['/tmp/wcwallet/wallet.mjs', uri, mode], { cwd: dir, env: { ...process.env, WC_PROJECT_ID: PROJECT_ID } });
  const lines = [];
  const on = (d) => String(d).split('\n').filter(Boolean).forEach((l) => lines.push(l));
  proc.stdout.on('data', on); proc.stderr.on('data', on);
  return {
    lines, dir,
    wait: async (re, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = lines.find((l) => re.test(l)); if (m) return m; await sleep(250); } return null; },
    count: (re) => lines.filter((l) => re.test(l)).length,
    cmd: (c) => fs.appendFileSync(path.join(dir, 'cmd.txt'), c + '\n'),
    address: () => (lines.find((l) => /address 0x/.test(l)) || '').match(/0x[0-9a-fA-F]{40}/)?.[0],
    stop: () => { try { proc.kill('SIGKILL'); } catch { /* already gone */ } },
  };
}

export const connectBtn = (page) => page.getByRole('button', { name: /^Connect$/ }).first();
export const panelOf = (page) => page.locator('[role=dialog][aria-label=WalletConnect]');

export async function openWalletConnect(page) {
  await connectBtn(page).click({ timeout: 30000 });
  await page.locator('[data-testid=wallet-option-walletconnect]').click({ timeout: 15000 });
  const panel = panelOf(page);
  await panel.waitFor({ state: 'visible', timeout: 15000 });
  return panel;
}

/** Waits for the QR (the relay accepted the Project ID) and reads the pairing URI through the panel's own "Copy link" button. */
export async function getUri(page, panel) {
  await panel.locator('img[alt="WalletConnect QR Code"]').waitFor({ state: 'visible', timeout: 60000 });
  await panel.getByRole('button', { name: /copy link/i }).click();
  return page.evaluate(() => navigator.clipboard.readText());
}

export const shortOf = (addr) => ({ head: addr.slice(0, 6).toLowerCase(), tail: addr.slice(-4).toLowerCase() });
export async function showsAddress(page, addr, timeout = 30000) {
  const { head, tail } = shortOf(addr);
  try { await page.waitForFunction(([h, t]) => { const x = document.body.innerText.toLowerCase(); return x.includes(h) && x.includes(t); }, [head, tail], { timeout }); return true; } catch { return false; }
}
export const hasText = async (page, re, timeout = 15000) => { try { await page.getByText(re).first().waitFor({ state: 'visible', timeout }); return true; } catch { return false; } };

/** Independent check of what the SDK really persisted (it uses IndexedDB). */
export async function stored(page) {
  return page.evaluate(async () => {
    const out = { session: false, keys: 0 };
    try {
      const dbs = (await indexedDB.databases?.()) ?? [];
      if (!dbs.some((d) => d.name === 'WALLET_CONNECT_V2_INDEXED_DB')) return out;
      await new Promise((res) => {
        const r = indexedDB.open('WALLET_CONNECT_V2_INDEXED_DB');
        r.onerror = () => res(null);
        r.onsuccess = () => {
          const db = r.result;
          if (![...db.objectStoreNames].includes('keyvaluestorage')) { db.close(); return res(null); }
          const st = db.transaction('keyvaluestorage').objectStore('keyvaluestorage');
          const kr = st.getAllKeys();
          kr.onsuccess = () => {
            out.keys = kr.result.length;
            const key = kr.result.map(String).find((k) => /^wc@2:client:[^:]+:session$/.test(k));
            if (!key) { db.close(); return res(null); }
            const g = st.get(key);
            g.onsuccess = () => { const v = g.result; out.session = Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.length > 2 && v !== '[]' : !!v; db.close(); res(null); };
            g.onerror = () => { db.close(); res(null); };
          };
          kr.onerror = () => { db.close(); res(null); };
        };
      });
    } catch { /* report what we have */ }
    return out;
  });
}
