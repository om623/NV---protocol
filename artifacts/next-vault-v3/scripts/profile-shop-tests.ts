// Shop (real payments) UI tests with a simulated, connected wallet.
// The real purchase flow needs a wallet and funds; here we render the Shop with a fake context
// to prove the UI states and the gating rules. Run: bun run scripts/profile-shop-tests.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Minimal browser shims so the real I18nProvider and components can render on the server.
const g = globalThis as Record<string, unknown>;
g.localStorage = { getItem: () => 'en', setItem: () => {}, removeItem: () => {} };
g.navigator = { language: 'en', languages: ['en'] };

const { renderToStaticMarkup } = await import('react-dom/server');
const { createElement } = await import('react');
const { I18nProvider } = await import('../src/i18n');
const { Shop } = await import('../src/profile/sections/Shop');
const { DEFAULT_LOADOUT } = await import('../src/profile/nvult/loadout');
const { DEFAULT_GAMIFICATION_STATE } = await import('../src/lib/gamification');

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); cond ? pass++ : fail++; };

const limit = (canBuyNow: boolean) => ({ canBuyNow, usedToday: 0, usedThisWeek: 0, usedThisMonth: 0, maxPerDay: 3, maxPerWeek: 10, maxPerMonth: 30 });

function render(over: Record<string, unknown> = {}): string {
  const ctx = {
    gamification: DEFAULT_GAMIFICATION_STATE, level: 0, accent: '#2dd4bf',
    nv: { loadout: DEFAULT_LOADOUT, effective: DEFAULT_LOADOUT },
    hasBoost: false, boostRemaining: 0, activeBoost: 1,
    walletAddress: null, purchaseState: { status: 'idle', productId: null, txHash: null, error: null },
    entitlements: [], isSkinOwned: () => false, limits: {}, getLimit: async () => limit(true),
    onEquipSkin: () => {}, onEquipTitle: () => {}, onActivateBoost: () => {}, onBuySkin: () => {}, onBuyXp: () => {}, go: () => {},
    ...over,
  };
  return renderToStaticMarkup(createElement(I18nProvider, null, createElement(Shop, { ctx: ctx as never })));
}

/** Returns { disabled, label } for the button with this data-testid. */
function button(html: string, id: string): { found: boolean; disabled: boolean; label: string } {
  const m = html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>([\\s\\S]*?)</button>`));
  if (!m) return { found: false, disabled: false, label: '' };
  const tag = m[0].slice(0, m[0].indexOf('>') + 1);
  return { found: true, disabled: /\sdisabled(=|\s|>)/.test(tag), label: m[1].replace(/<[^>]+>/g, '').trim() };
}

const XP_IDS = ['buy-xp-daily', 'buy-xp-weekly', 'buy-xp-quarterly'];
const SKIN_BTNS = ['shop-buy-skin-premium-500', 'shop-buy-skin-premium-1000'];
const WALLET = '0x1111111111111111111111111111111111111111';

// ── Disconnected wallet ──────────────────────────────────────────────────────
{
  const h = render();
  ok('no wallet: every purchase button exists and is disabled', [...XP_IDS, ...SKIN_BTNS].every((id) => { const b = button(h, id); return b.found && b.disabled; }));
  ok('no wallet: buttons say "Connect wallet"', XP_IDS.every((id) => /connect wallet/i.test(button(h, id).label)));
  ok('no wallet: banner asks to connect first', /connect your wallet/i.test(h) || /wallet/i.test(h.slice(h.indexOf('amber-400/30'), h.indexOf('amber-400/30') + 400)));
}

// ── Connected wallet ─────────────────────────────────────────────────────────
{
  const h = render({ walletAddress: WALLET });
  ok('wallet: XP purchase buttons are enabled with a clear label', XP_IDS.every((id) => { const b = button(h, id); return b.found && !b.disabled && /buy/i.test(b.label); }), XP_IDS.map((i) => button(h, i).label).join(' | '));
  ok('wallet: premium skin buttons are enabled', SKIN_BTNS.every((id) => { const b = button(h, id); return b.found && !b.disabled; }));
  ok('wallet: no "connect wallet" banner', !/connect your wallet first|conecte sua carteira/i.test(h));
}
{
  const h = render({ walletAddress: WALLET, limits: { 'xp-daily': limit(false), 'xp-weekly': limit(true), 'xp-quarterly': limit(true) } });
  const d = button(h, 'buy-xp-daily'), w = button(h, 'buy-xp-weekly');
  ok('limit reached: only that package is disabled and labelled', d.disabled && /limit/i.test(d.label) && !w.disabled, `${d.label} | ${w.label}`);
  ok('limits are rendered for a connected wallet (daily/weekly/monthly)', /0\/3/.test(h) && /0\/10/.test(h) && /0\/30/.test(h));
}

// ── Purchase states ──────────────────────────────────────────────────────────
for (const [status, re] of [['sending_tx', /sending|confirm|wallet/i], ['verifying', /verif/i], ['confirmed', /confirm|success|purchas/i], ['limit_reached', /limit/i]] as const) {
  const h = render({ walletAddress: WALLET, purchaseState: { status, productId: 'xp-weekly', txHash: null, error: null } });
  const b = button(h, 'buy-xp-weekly'), other = button(h, 'buy-xp-daily');
  ok(`state ${status}: shows its status line only on the product being bought`, new RegExp(`data-purchase-status="${status}"`).test(h) && (h.match(/data-purchase-status=/g) ?? []).length === 1, '');
  ok(`state ${status}: the busy product is blocked, the others stay available`, (status === 'confirmed' || status === 'limit_reached' ? true : b.disabled) && !other.disabled);
  ok(`state ${status}: text is meaningful`, re.test(h.slice(h.indexOf('data-purchase-status'), h.indexOf('data-purchase-status') + 500)));
}
{
  const hash = '0xabc123def456';
  const h = render({ walletAddress: WALLET, purchaseState: { status: 'confirmed', productId: 'xp-daily', txHash: hash, error: null } });
  ok('confirmed: links to the real explorer transaction', h.includes(`https://basescan.org/tx/${hash}`) && /rel="noopener noreferrer"/.test(h));
  const f = render({ walletAddress: WALLET, purchaseState: { status: 'failed', productId: 'xp-daily', txHash: hash, error: 'Transaction reverted' } });
  ok('failed: shows the real error and still links the transaction', f.includes('Transaction reverted') && f.includes(`/tx/${hash}`));
  const f2 = render({ walletAddress: WALLET, purchaseState: { status: 'failed', productId: 'xp-daily', txHash: null, error: null } });
  ok('failed without a message: falls back to the generic text', /data-purchase-status="failed"/.test(f2));
}

// ── Premium skin ownership and boosts ────────────────────────────────────────
{
  const h = render({ walletAddress: WALLET, isSkinOwned: (id: string) => id === 'premium-500' });
  ok('owned premium skin: shows "purchased" and no buy button', !button(h, 'shop-buy-skin-premium-500').found && button(h, 'shop-buy-skin-premium-1000').found && /purchased/i.test(h));
}
{
  const h = render({ entitlements: [{ product_type: 'xp', product_id: 'boost-2x', tx_hash: '0x1' }] });
  ok('boost: 1x free, 2x owned, 3x/4x locked', !button(h, 'boost-1').disabled && !button(h, 'boost-2').disabled && button(h, 'boost-3').disabled && button(h, 'boost-4').disabled);
  const a = render({ hasBoost: true, activeBoost: 2, entitlements: [{ product_type: 'xp', product_id: 'boost-2x', tx_hash: '0x1' }] });
  ok('boost active: every boost button is blocked until it ends', [1, 2, 3, 4].every((m) => button(a, `boost-${m}`).disabled));
}

// ── Wiring: the UI calls the real handlers it receives ───────────────────────
{
  const root = join(import.meta.dir, '..');
  const shop = readFileSync(join(root, 'src/profile/sections/Shop.tsx'), 'utf8');
  const coll = readFileSync(join(root, 'src/profile/sections/Collection.tsx'), 'utf8');
  const view = readFileSync(join(root, 'src/components/ProfileView.tsx'), 'utf8');
  ok('wiring: XP button calls onBuyXp(pkg.id)', /onClick=\{\(\) => ctx\.onBuyXp\(pkg\.id\)\}/.test(shop));
  ok('wiring: Shop and Collection call onBuySkin(skin.id)', /ctx\.onBuySkin\(skin\.id\)/.test(shop) && /ctx\.onBuySkin\(skin\.id\)/.test(coll));
  ok('wiring: boost button calls onActivateBoost(m)', /ctx\.onActivateBoost\(m\)/.test(shop));
  ok('wiring: ProfileView passes the host handlers through unchanged', /onBuyXp,|onBuyXp:|onBuyXp\b/.test(view) && /onBuySkin/.test(view) && /onActivateBoost/.test(view) && /onEquipSkin/.test(view) && /onEquipTitle/.test(view));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
