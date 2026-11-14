// WalletConnect integration tests. Run: bun run scripts/walletconnect-tests.ts
// The SDK is replaced by a recording fake so the test checks exactly what NV asks it for. The real SDK + relay + Project ID are
// exercised separately end to end (see docs/walletconnect.md, "Tested").
import { mock } from 'bun:test';
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); };
const root = join(import.meta.dir, '..');
const LIB = join(root, 'src/lib/walletConnect.ts');
const TEST_ID = '0123456789abcdef0123456789abcdef';

// ── environment shims (the lib runs in a browser) ────────────────────────────
const store = new Map<string, string>();
class FakeWS {
  static urls: string[] = []; static made: FakeWS[] = [];
  private handlers = new Map<string, Array<(e: unknown) => void>>();
  constructor(public url: unknown, public protocols?: unknown) { FakeWS.urls.push(String(url)); FakeWS.made.push(this); }
  addEventListener(t: string, h: (e: unknown) => void) { (this.handlers.get(t) ?? this.handlers.set(t, []).get(t)!).push(h); }
  fire(t: string, e: unknown = {}) { this.handlers.get(t)?.forEach((h) => h(e)); }
}
const fakeWindow: Record<string, unknown> & { location: { origin: string; protocol: string; host: string } } = { location: { origin: 'https://nv.example.test', protocol: 'https:', host: 'nv.example.test' }, WebSocket: FakeWS };
(globalThis as unknown as { window: unknown }).window = fakeWindow;
const docListeners = new Map<string, Set<(e: unknown) => void>>();
(globalThis as unknown as { document: unknown }).document = {
  addEventListener: (t: string, h: (e: unknown) => void) => { (docListeners.get(t) ?? docListeners.set(t, new Set()).get(t)!).add(h); },
  removeEventListener: (t: string, h: (e: unknown) => void) => { docListeners.get(t)?.delete(h); },
};
const fireViolation = (blockedURI: string) => docListeners.get('securitypolicyviolation')?.forEach((h) => h({ blockedURI }));
const violationListeners = () => docListeners.get('securitypolicyviolation')?.size ?? 0;
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  get length() { return store.size; }, key: (i: number) => [...store.keys()][i] ?? null,
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k),
};
const idbKeys: Record<string, unknown> = {};
let idbExists = false;
(globalThis as unknown as { indexedDB: unknown }).indexedDB = {
  open: () => {
    const req: Record<string, unknown> & { onupgradeneeded?: () => void; onsuccess?: () => void; onerror?: () => void; transaction?: { abort(): void } } = { transaction: { abort() {} } };
    queueMicrotask(() => {
      if (!idbExists) { req.onupgradeneeded?.(); req.onerror?.(); return; }
      const mkReq = (result: unknown) => { const r: { result: unknown; onsuccess?: () => void } = { result }; queueMicrotask(() => r.onsuccess?.()); return r; };
      req.result = { objectStoreNames: { contains: (n: string) => n === 'keyvaluestorage' }, close() {},
        transaction: () => ({ objectStore: () => ({ getAllKeys: () => mkReq(Object.keys(idbKeys)), get: (k: string) => mkReq(idbKeys[k]) }) }) };
      req.onsuccess?.();
    });
    return req;
  },
};

// ── recording fake of the SDK ────────────────────────────────────────────────
type Handler = (...a: unknown[]) => void;
let initCalls: Array<Record<string, unknown>> = [];
let connectBehaviour: 'approve' | 'reject5000' | 'expired' | 'hang' | 'slow' = 'approve';
let initGate: Promise<void> | null = null;
let abortCalls = 0;
const makeProvider = () => {
  const handlers = new Map<string, Set<Handler>>();
  const p: Record<string, unknown> & { session?: unknown; accounts: string[] } = {
    accounts: [], session: undefined,
    on: (e: string, h: Handler) => { (handlers.get(e) ?? handlers.set(e, new Set()).get(e)!).add(h); },
    removeListener: (e: string, h: Handler) => { handlers.get(e)?.delete(h); },
    emit: (e: string, ...a: unknown[]) => handlers.get(e)?.forEach((h) => h(...a)),
    signer: { abortPairingAttempt: () => { abortCalls++; } },
    request: async () => null,
    disconnect: async () => { p.session = undefined; p.accounts = []; },
    connect: () => {
      if (connectBehaviour === 'hang') return new Promise(() => {});
      if (connectBehaviour === 'slow') {
        queueMicrotask(() => (p as unknown as { emit: Handler }).emit('display_uri', 'wc:slow@2?relay-protocol=irn&symKey=00'));
        return new Promise<void>((res) => setTimeout(() => { p.session = { peer: { metadata: { name: 'Slow', icons: [] } }, namespaces: { eip155: { chains: ['eip155:1'], accounts: ['eip155:1:0xabc'] } } }; p.accounts = ['0xabc']; res(); }, 220));
      }
      queueMicrotask(() => (p as unknown as { emit: Handler }).emit('display_uri', 'wc:fakeuri@2?relay-protocol=irn&symKey=00'));
      if (connectBehaviour === 'reject5000') return Promise.reject(Object.assign(new Error('User rejected'), { code: 5000 }));
      if (connectBehaviour === 'expired') return Promise.reject(new Error('Proposal expired'));
      p.session = { peer: { metadata: { name: 'Fake', icons: [] } }, namespaces: { eip155: { chains: ['eip155:1', 'eip155:5042002'], accounts: ['eip155:1:0xabc', 'eip155:5042002:0xabc'] } } };
      p.accounts = ['0xabc'];
      return Promise.resolve();
    },
  };
  return p;
};
mock.module('@walletconnect/ethereum-provider', () => ({
  EthereumProvider: { init: async (opts: Record<string, unknown>) => { initCalls.push(opts); if (initGate) await initGate; return makeProvider(); } },
}));

// ── 1. Project ID is read from the environment ───────────────────────────────
process.env.VITE_WALLETCONNECT_PROJECT_ID = TEST_ID;
const wc = await import(LIB);
ok('configured when VITE_WALLETCONNECT_PROJECT_ID is set', wc.isWalletConnectConfigured() === true);

// a fresh process WITHOUT the variable: not configured, and connecting fails with the right code (no crash, no network)
const probe = (env: Record<string, string>) => spawnSync('bun', ['-e', `const w = await import(${JSON.stringify(LIB)}); const r = { configured: w.isWalletConnectConfigured() }; try { await w.connectWalletConnect(() => {}, new AbortController().signal); r.code = 'none'; } catch (e) { r.code = e.code; } console.log(JSON.stringify(r));`], { env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' });
const noId = JSON.parse(probe({}).stdout.trim().split('\n').pop() ?? '{}');
ok('not configured without the variable, and connect() fails with "not-configured"', noId.configured === false && noId.code === 'not-configured', JSON.stringify(noId));
const blank = JSON.parse(probe({ VITE_WALLETCONNECT_PROJECT_ID: '   ' }).stdout.trim().split('\n').pop() ?? '{}');
ok('a blank variable counts as not configured', blank.configured === false, JSON.stringify(blank));

// ── 2. What NV asks the SDK for ──────────────────────────────────────────────
connectBehaviour = 'approve';
const uris: string[] = [];
const ac = new AbortController();
const w1 = await wc.connectWalletConnect((u: string) => uris.push(u), ac.signal);
const o = initCalls[0] as { projectId: string; optionalChains: number[]; showQrModal: boolean; metadata: { name: string; url: string; icons: string[] }; rpcMap: Record<string, string> };
ok('the SDK is initialised with the configured Project ID', o.projectId === TEST_ID);
ok('NV renders its own QR panel (the SDK modal is off)', o.showQrModal === false);
ok('the SDK keeps its default relay address (a custom relayUrl makes the relay answer HTTP 401)', !('relayUrl' in (o as object)));
ok('app metadata identifies NV and its origin', o.metadata.name === 'NV Protocol' && o.metadata.url === 'https://nv.example.test' && o.metadata.icons[0].startsWith('https://nv.example.test/'));
const { NETWORKS_CONFIG } = await import(join(root, 'src/networks.ts'));
const live = NETWORKS_CONFIG.filter((n: { comingSoon?: boolean; rpcUrl?: string }) => !n.comingSoon && n.rpcUrl);
const ids = new Set(o.optionalChains);
ok(`every live NV network is requested as optional (${live.length}), Ethereum mainnet included`, live.every((n: { chainId: number }) => ids.has(n.chainId)) && ids.has(1));
ok('no chain is mandatory: the deprecated chains option is omitted', !Object.prototype.hasOwnProperty.call(o, 'chains'));
ok('Arc (5042) and Arc Testnet (5042002) are requested', ids.has(5042) && ids.has(5042002));
ok('networks marked "coming soon" are not requested', NETWORKS_CONFIG.filter((n: { comingSoon?: boolean }) => n.comingSoon).every((n: { chainId: number }) => !ids.has(n.chainId)));
ok('every requested network has an RPC URL', [...ids].every((id) => typeof o.rpcMap[String(id)] === 'string'));
ok('the pairing URI reaches the panel', uris.length === 1 && uris[0].startsWith('wc:') && /relay-protocol=irn/.test(uris[0]));
ok('connect() hands NV an EIP-1193 provider named after the wallet', w1.provider && w1.id === 'walletconnect' && /Fake/.test(w1.name));

// ── 3. One SDK instance for the whole page ───────────────────────────────────
ok('the SDK is initialised once', initCalls.length === 1);
await wc.disconnectWalletConnect();
const w2 = await wc.connectWalletConnect(() => {}, new AbortController().signal);
ok('after a disconnect the next connect reuses the same SDK instance (no second Init)', initCalls.length === 1 && !!w2);
ok('the provider handed out is the managed one', wc.isWalletConnectProvider(w2.provider) && !wc.isWalletConnectProvider({}));

// ── 4. Errors: rejection, expiry, cancel; never a second init ────────────────
await wc.disconnectWalletConnect();
connectBehaviour = 'reject5000';
const rej = await wc.connectWalletConnect(() => {}, new AbortController().signal).then(() => 'ok', (e: { code: string }) => e.code);
ok('a rejection in the wallet is classified "rejected"', rej === 'rejected', String(rej));
connectBehaviour = 'expired';
const exp = await wc.connectWalletConnect(() => {}, new AbortController().signal).then(() => 'ok', (e: { code: string }) => e.code);
ok('an expired pairing is classified "expired"', exp === 'expired', String(exp));
ok('failures cancel the pending pairing and keep the SDK instance', abortCalls >= 2 && initCalls.length === 1, `aborts=${abortCalls}, inits=${initCalls.length}`);
connectBehaviour = 'hang';
const cancel = new AbortController();
const pending = wc.connectWalletConnect(() => {}, cancel.signal).then(() => 'ok', (e: { code: string }) => e.code);
await new Promise((r) => setTimeout(r, 20)); cancel.abort();
ok('closing the window while waiting is classified "cancelled"', (await pending) === 'cancelled');
ok('cancelling still never initialises the SDK a second time', initCalls.length === 1);

// ── 4b. Time limits: an SDK or relay that never answers must end in an error, not an endless "Preparing connection..." ──────────
{
  const F = await import(LIB + '?fresh-init');
  F.WC_TIMEOUTS.init = 80; F.WC_TIMEOUTS.uri = 80;
  const before = initCalls.length;
  let release!: () => void; initGate = new Promise<void>((r) => { release = r; });
  const t0 = Date.now();
  const r1 = await F.connectWalletConnect(() => {}, new AbortController().signal).then(() => 'ok', (e: { code: string }) => e.code);
  ok("a stuck SDK start-up ends in a 'timeout' error instead of waiting forever", r1 === 'timeout' && Date.now() - t0 < 1500, `${r1} after ${Date.now() - t0} ms`);
  release(); initGate = null; connectBehaviour = 'approve';
  const r2 = await F.connectWalletConnect(() => {}, new AbortController().signal).then(() => 'ok', (e: { code: string }) => e.code);
  ok('"Try again" waits on the SAME start-up and succeeds when it finishes', r2 === 'ok', String(r2));
  ok('the SDK was initialised once for both attempts (never a second Core)', initCalls.length === before + 1, `${initCalls.length - before} init call(s)`);
  await F.disconnectWalletConnect();
}
{
  const F = await import(LIB + '?fresh-uri');
  F.WC_TIMEOUTS.init = 500; F.WC_TIMEOUTS.uri = 80;
  connectBehaviour = 'hang'; const a0 = abortCalls; const i0 = initCalls.length;
  const t0 = Date.now();
  const r = await F.connectWalletConnect(() => {}, new AbortController().signal).then(() => 'ok', (e: { code: string }) => e.code);
  ok("a pairing that never produces a QR Code ends in a 'timeout' error", r === 'timeout' && Date.now() - t0 < 1500, `${r} after ${Date.now() - t0} ms`);
  ok('the pending pairing is cancelled and the SDK is not re-initialised', abortCalls === a0 + 1 && initCalls.length === i0 + 1, `aborts +${abortCalls - a0}, inits +${initCalls.length - i0}`);
  connectBehaviour = 'slow'; const uris2: string[] = [];
  const slow = await F.connectWalletConnect((u: string) => uris2.push(u), new AbortController().signal).then(() => 'ok', (e: { code: string }) => e.code);
  ok('once the QR is shown the wait for the wallet is NOT cut by the QR time limit', slow === 'ok' && uris2.length === 1, `${slow}, ${uris2.length} URI`);
  await F.disconnectWalletConnect(); connectBehaviour = 'approve';
}

// ── 4c. A security policy that blocks the relay is reported at once, with the real cause ─────────────────────────────────────────
{
  const F = await import(LIB + '?fresh-csp');
  connectBehaviour = 'hang';
  const attempt = () => F.connectWalletConnect(() => {}, new AbortController().signal).then(() => 'ok', (e: { code: string; message: string }) => ({ code: e.code, message: e.message }));
  let p = attempt(); await new Promise((r) => setTimeout(r, 30));
  const listening = violationListeners() > 0;
  fireViolation('https://api.coingecko.com/api/v3/global');
  fireViolation('https://pulse.walletconnect.org/e');
  await new Promise((r) => setTimeout(r, 20));
  ok('violations for other hosts (market data, analytics) are ignored', listening && violationListeners() > 0);
  fireViolation('wss://relay.walletconnect.org');
  let res = await p as { code: string };
  ok("a blocked direct relay socket is reported as 'blocked' immediately", res.code === 'blocked', JSON.stringify(res));
  ok('the violation listener is removed afterwards', violationListeners() === 0);
  p = attempt(); await new Promise((r) => setTimeout(r, 30));
  fireViolation('wss://nv.example.test/wc-relay?auth=SECRET-TOKEN&projectId=x');
  res = await p as { code: string; message: string };
  ok("a blocked same-origin relay path is reported as 'blocked' too", res.code === 'blocked');
  ok('the error never carries the relay auth token', !/SECRET-TOKEN|auth=/.test(res.message), res.message);
  connectBehaviour = 'approve'; await F.disconnectWalletConnect();
}

// ── 4d. Development / Preview only: the relay socket goes through the same-origin proxy ────────────────────────────────────────────
{
  const orig = FakeWS; const flag = '__nvWcRelayRedirect';
  delete process.env.DEV; delete fakeWindow[flag]; fakeWindow.WebSocket = orig;
  wc.installDevRelayRedirect();
  ok('production (DEV off): the WebSocket is left exactly as it was', fakeWindow.WebSocket === orig && !fakeWindow[flag]);
  ok('production (DEV off): the diagnostics getter returns nothing', wc.getWalletConnectDiagnostics() === null);
  process.env.DEV = 'true';
  wc.installDevRelayRedirect();
  const WS2 = fakeWindow.WebSocket as typeof FakeWS;
  ok('development: the WebSocket class is replaced by the redirecting one', WS2 !== orig && fakeWindow[flag] === true);
  new WS2('wss://relay.walletconnect.org/?auth=A&projectId=B&ua=C');
  ok('the relay socket is redirected to the page\'s own /wc-relay, query kept', FakeWS.urls.at(-1) === 'wss://nv.example.test/wc-relay?auth=A&projectId=B&ua=C', FakeWS.urls.at(-1));
  fakeWindow.location.protocol = 'http:'; fakeWindow.location.host = 'localhost:5173';
  new WS2('wss://relay.walletconnect.org/?auth=A');
  ok('on an http page the redirect uses ws://', FakeWS.urls.at(-1) === 'ws://localhost:5173/wc-relay?auth=A', FakeWS.urls.at(-1));
  new WS2('ws://localhost:5173/?token=hmr', 'vite-hmr'); new WS2('wss://other.example/socket?x=1');
  ok("Vite's own HMR socket and any other socket are untouched", FakeWS.urls.at(-2) === 'ws://localhost:5173/?token=hmr' && FakeWS.urls.at(-1) === 'wss://other.example/socket?x=1');
  const diag0 = wc.getWalletConnectDiagnostics();
  const before = diag0 ? diag0.sockets : -1;
  const relaySock = new WS2('wss://relay.walletconnect.org/?auth=SECRET-TOKEN&projectId=x') as unknown as FakeWS;
  relaySock.fire('open'); relaySock.fire('error'); relaySock.fire('close', { code: 1006 });
  new WS2('wss://other.example/socket');
  const diag1 = wc.getWalletConnectDiagnostics();
  ok('development diagnostics count relay sockets only (created, opened, errored, close code)', !!diag1 && diag1.sockets === before + 1 && diag1.opened >= 1 && diag1.errors >= 1 && diag1.closes['1006'] >= 1, JSON.stringify(diag1));
  ok('the diagnostics never contain a URL or a token', !/SECRET-TOKEN|wss?:\/\/|auth=/.test(JSON.stringify(diag1)));
  const installed = fakeWindow.WebSocket; wc.installDevRelayRedirect();
  ok('installing twice does not wrap the class twice', fakeWindow.WebSocket === installed);
  delete process.env.DEV; delete fakeWindow[flag]; fakeWindow.WebSocket = orig;
  fakeWindow.location.protocol = 'https:'; fakeWindow.location.host = 'nv.example.test';
}
{
  const cfg = readFileSync(join(root, 'vite.config.ts'), 'utf8');
  const server = cfg.indexOf('server: {'), preview = cfg.indexOf('preview: {'), proxy = cfg.indexOf("'/wc-relay'");
  ok('the /wc-relay proxy exists, forwards WebSockets, and sits in the dev server block only', proxy > server && proxy < preview && /'\/wc-relay': \{[^}]*ws: true/s.test(cfg));
  const entry = cfg.slice(proxy, cfg.indexOf("// Proxy Yahoo Finance", proxy));
  ok('the proxy target is the Reown relay', /target: 'https:\/\/relay\.walletconnect\.org'/.test(entry));
  ok("the proxy sets no 'headers:' of its own, so the browser's Origin reaches the relay unchanged", !/\bheaders\s*:/.test(entry));
  ok('the proxy log never prints the request URL (it carries the relay auth token)', !/console\.\w+\([^)]*req\.url/.test(cfg));
}

// ── 5. Approved networks and the "session ended" notice ──────────────────────
connectBehaviour = 'approve';
await wc.connectWalletConnect(() => {}, new AbortController().signal);
ok('a network in the session is usable', wc.isChainApprovedInWalletConnectSession(5042002) === true && wc.isChainApprovedInWalletConnectSession(1) === true);
ok('a network outside the session is NOT usable', wc.isChainApprovedInWalletConnectSession(5042) === false && wc.isChainApprovedInWalletConnectSession(8453) === false);
ok('the session reports itself alive', wc.isWalletConnectSessionAlive() === true);
let ended = 0; const off = wc.onWalletConnectSessionEnded(() => { ended++; });
const providerInUse = (await wc.connectWalletConnect(() => {}, new AbortController().signal)).provider as { emit: Handler; session?: unknown };
providerInUse.emit('disconnect');
ok('when the WALLET ends the session NV is told once', ended === 1);
providerInUse.emit('disconnect');
ok('the same ending is not reported twice', ended === 1);
await wc.connectWalletConnect(() => {}, new AbortController().signal);
await wc.disconnectWalletConnect();
(providerInUse as { emit: Handler }).emit('disconnect');
ok('a disconnect started by the user is NOT reported as "interrupted"', ended === 1);
off();

// ── 6. Reconnection: is there a saved session to restore? (IndexedDB is where SDK 2.2x keeps it) ──
store.clear();
idbExists = false;
ok('no saved session -> nothing to restore (and the database is never created by the probe)', (await wc.hasPersistedWalletConnectSession()) === false);
idbExists = true;
idbKeys['wc@2:client:0.3:proposal'] = '[]';
ok('a database without a session key -> nothing to restore', (await wc.hasPersistedWalletConnectSession()) === false);
idbKeys['wc@2:client:0.3:session'] = '[]';
ok('an empty session list -> nothing to restore', (await wc.hasPersistedWalletConnectSession()) === false);
idbKeys['wc@2:client:0.3:session'] = [{ topic: 'abc', namespaces: {} }];
ok('a saved session in IndexedDB -> restore it', (await wc.hasPersistedWalletConnectSession()) === true);
idbKeys['wc@2:client:0.3:session'] = '[{"topic":"abc"}]';
ok('a JSON-serialised session is understood too', (await wc.hasPersistedWalletConnectSession()) === true);
for (const k of Object.keys(idbKeys)) delete idbKeys[k];
store.set('wc@2:client:0.3//session', '[{"topic":"abc"}]');
ok('the older localStorage layout still counts', (await wc.hasPersistedWalletConnectSession()) === true);
store.set('wc@2:client:0.3//session', '[]');
ok('an empty localStorage session does not', (await wc.hasPersistedWalletConnectSession()) === false);

// ── 7. The Project ID never lives in the source ──────────────────────────────
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : []; });
const hex32 = /\b[0-9a-f]{32}\b/;
const offenders = walk(join(root, 'src')).filter((f) => /walletconnect|reown/i.test(readFileSync(f, 'utf8')) && hex32.test(readFileSync(f, 'utf8')));
ok('no 32-character project id is hard-coded in any WalletConnect source file', offenders.length === 0, offenders.join(' '));

// ── 8. Nine languages, same keys ─────────────────────────────────────────────
const tr = readFileSync(join(root, 'src/i18n/translations.ts'), 'utf8');
const blocks = ['ptBR', 'en', 'es', 'fr', 'zh', 'ja', 'ko', 'hi', 'ar'].map((n) => { const a = tr.indexOf(`const ${n}: Dict = {`); const b = tr.indexOf('\n};', a); return { n, text: tr.slice(a, b) }; });
const keysOf = (t: string) => new Set([...t.matchAll(/^\s*'(wc\.[A-Za-z]+)':/gm)].map((m) => m[1]));
const ref = keysOf(blocks[1].text);
ok(`the English block has all ${ref.size} wc.* keys`, ref.size === 19, String(ref.size));
ok('all nine languages have exactly the same wc.* keys', blocks.every((b) => { const k = keysOf(b.text); return k.size === ref.size && [...ref].every((x) => k.has(x)); }), blocks.map((b) => `${b.n}:${keysOf(b.text).size}`).join(' '));
ok('every wc.* string is non-empty', blocks.every((b) => [...b.text.matchAll(/^\s*'wc\.[A-Za-z]+':\s*'([^']*(?:\\'[^']*)*)'/gm)].every((m) => m[1].trim().length >= 2)));
const usedKeys = new Set<string>();
for (const f of [join(root, 'src/App.tsx'), join(root, 'src/components/WalletConnectPanel.tsx'), join(root, 'src/components/WalletPickerModal.tsx')]) for (const m of readFileSync(f, 'utf8').matchAll(/t\('(wc\.[A-Za-z]+)'\)/g)) usedKeys.add(m[1]);
const dynamic = ['wc.notConfigured', 'wc.rejected', 'wc.expired', 'wc.failed'];
ok('every wc.* key in the dictionary is used by the code', [...ref].every((k) => usedKeys.has(k) || dynamic.includes(k)), [...ref].filter((k) => !usedKeys.has(k) && !dynamic.includes(k)).join(' '));
ok('every wc.* key the code uses exists', [...usedKeys].every((k) => ref.has(k)), [...usedKeys].filter((k) => !ref.has(k)).join(' '));

// ── 9. Scope: only the intended files changed against the main this work started from ──
let changed: string[] = [];
try { changed = execSync('git diff --name-only 1e94376 -- .', { cwd: join(root, '../..'), encoding: 'utf8' }).split('\n').filter(Boolean); } catch { /* history unavailable */ }
if (changed.length) {
  const allowed = [/^artifacts\/next-vault-v3\/package\.json$/, /^artifacts\/next-vault-v3\/src\/App\.tsx$/, /^artifacts\/next-vault-v3\/src\/components\/WalletPickerModal\.tsx$/, /^artifacts\/next-vault-v3\/src\/components\/WalletConnectPanel\.tsx$/, /^artifacts\/next-vault-v3\/src\/lib\/walletConnect\.ts$/, /^artifacts\/next-vault-v3\/src\/i18n\/translations\.ts$/, /^artifacts\/next-vault-v3\/vite\.config\.ts$/, /^artifacts\/next-vault-v3\/scripts\/walletconnect-tests\.ts$/, /^docs\/walletconnect\.md$/, /^pnpm-lock\.yaml$/, /^pnpm-workspace\.yaml$/];
  const stray = changed.filter((f) => !allowed.some((r) => r.test(f)));
  ok('only WalletConnect-related files were touched', stray.length === 0, stray.join(' '));
  const protectedTouched = changed.filter((f) => /Swap|Bridge|Cctp|CCTP|Solana|Radar|Agent|Dashboard|Executive|Market|Profile/i.test(f));
  ok('Swap, Bridge, CCTP, Solana, Radar, NV Agent, Dashboard, Market and Profile files are untouched', protectedTouched.length === 0, protectedTouched.join(' '));
} else console.log('SKIP scope checks (git history not available)');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
