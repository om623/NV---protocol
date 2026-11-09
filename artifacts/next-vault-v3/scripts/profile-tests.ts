// Profile / Nvult logic tests. Run: bun run scripts/profile-tests.ts
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BADGES, TITLES } from '../src/lib/gamification';
import { ACCENTS, BODY_STYLES, FINISHES, PARTS, RARITY_COLOR, SLOTS, TIER_IDS, TIER_LEVELS, findPart, isPartUnlocked, partsFor, rarityOf, tierOf } from '../src/profile/nvult/catalog';
import { DEFAULT_LOADOUT, MAX_NAME, effectiveLoadout, randomLoadout, sanitizeLoadout, type Loadout } from '../src/profile/nvult/loadout';
import { NvultFigure } from '../src/profile/nvult/NvultFigure';
import { buildMilestones, progressTo, statusOf, tierInfo } from '../src/profile/progress';
import { PROFILE_KEYS, buildProfileDicts } from '../src/i18n/profile';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); };
const RARITIES = Object.keys(RARITY_COLOR);
const root = join(import.meta.dir, '..');
const LOCALES = ['pt-BR', 'en', 'es', 'fr', 'zh', 'ja', 'ko', 'hi', 'ar'] as const;

// ── 1. Catalog is consistent and aligned with the REAL engine thresholds ─────
{
  const keys = PARTS.map((p) => `${p.slot}:${p.id}`);
  ok('catalog: part ids are unique per slot', new Set(keys).size === keys.length);
  ok('catalog: every slot has parts', SLOTS.every((s) => partsFor(s).length >= 2));
  ok('catalog: default loadout uses valid, free parts', SLOTS.every((s) => { const p = findPart(s, DEFAULT_LOADOUT[s]); return !!p && p.levelRequired === 0; }));
  const engine = new Set<number>([...BADGES.map((b) => b.levelRequired), ...TITLES.map((t) => t.levelRequired)]);
  const gated = [...new Set(PARTS.filter((p) => p.levelRequired > 0).map((p) => p.levelRequired))];
  ok('catalog: every part unlock level is a real engine milestone', gated.every((l) => engine.has(l)), `levels=${gated.join(',')}`);
  ok('catalog: tier levels are engine milestones (plus 0)', TIER_LEVELS.every((l) => l === 0 || engine.has(l)));
  ok('catalog: 7 tiers, named', TIER_LEVELS.length === 7 && TIER_IDS.length === 7);
  ok('catalog: 8 accents with valid hex', ACCENTS.length === 8 && ACCENTS.every((a) => /^#[0-9a-f]{6}$/i.test(a.hex)));
  ok('catalog: finishes cover every real skin id', ['default', 'bronze', 'silver', 'gold', 'platinum', 'premium-500', 'premium-1000'].every((id) => !!FINISHES[id]));
  ok('catalog: at least one free option per slot, and some gated', SLOTS.every((s) => partsFor(s).some((p) => p.levelRequired === 0)) && PARTS.some((p) => p.levelRequired > 0));
}

// ── 2. Unlock and tier rules ─────────────────────────────────────────────────
{
  const mono = PARTS.every((p) => !isPartUnlocked(p, p.levelRequired - 0.5 > 0 ? p.levelRequired - 0.5 : -1) || p.levelRequired === 0)
    && PARTS.every((p) => isPartUnlocked(p, p.levelRequired));
  ok('unlock: a part is locked just below its level and open at it', mono);
  ok('unlock: level 0 opens only free parts', PARTS.filter((p) => isPartUnlocked(p, 0)).every((p) => p.levelRequired === 0));
  ok('unlock: a very high level opens everything', PARTS.every((p) => isPartUnlocked(p, 99999)));
  ok('rarity: derived from the real unlock level (no extra economy)', rarityOf(0) === 'common' && rarityOf(1000) === 'rare' && rarityOf(1250) === 'rare' && rarityOf(1500) === 'epic' && rarityOf(1750) === 'epic' && rarityOf(2000) === 'legendary' && rarityOf(2500) === 'mythic');
ok('rarity: every free part is common and every gated part is not', PARTS.every((p) => (p.levelRequired === 0) === (rarityOf(p.levelRequired) === 'common')));
ok('rarity: five distinct valid colours', new Set(Object.values(RARITY_COLOR)).size === 5 && Object.values(RARITY_COLOR).every((c) => /^#[0-9a-f]{6}$/i.test(c)));
ok('tier: boundaries', tierOf(0) === 0 && tierOf(999.5) === 0 && tierOf(1000) === 1 && tierOf(1249) === 1 && tierOf(1250) === 2 && tierOf(2499) === 5 && tierOf(2500) === 6 && tierOf(1e6) === 6);
  const t0 = tierInfo(0), t6 = tierInfo(5000), tm = tierInfo(1125);
  ok('tier info: first, last and mid progress', t0.index === 0 && t0.nextLevel === 1000 && t0.progress === 0 && t6.index === 6 && t6.nextLevel === null && t6.progress === 1 && tm.index === 1 && Math.abs(tm.progress - 0.5) < 1e-9);
  ok('progress: progressTo clamps 0..1', progressTo(-5, 100) === 0 && progressTo(50, 100) === 0.5 && progressTo(500, 100) === 1 && progressTo(5, 0) === 1);
}

// ── 3. Loadout safety ────────────────────────────────────────────────────────
{
  ok('sanitize: garbage input gives defaults', JSON.stringify(sanitizeLoadout(null)) === JSON.stringify(DEFAULT_LOADOUT) && JSON.stringify(sanitizeLoadout('x')) === JSON.stringify(DEFAULT_LOADOUT) && JSON.stringify(sanitizeLoadout(42)) === JSON.stringify(DEFAULT_LOADOUT));
  const dirty = sanitizeLoadout({ name: '  <script>alert(1)</script>  Very Long Name Indeed  ', accent: 'nope', style: 'x', head: 'ghost', armor: 'pulse', back: 7, weapon: 'blade', aura: null });
  ok('sanitize: unknown ids fall back, valid ones are kept', dirty.accent === 'teal' && dirty.style === 'classic' && dirty.head === DEFAULT_LOADOUT.head && dirty.armor === 'pulse' && dirty.weapon === 'blade' && dirty.back === 'none' && dirty.aura === 'none');
  ok('sanitize: name is stripped of markup characters and capped', !/[<>]/.test(dirty.name) && dirty.name.length <= MAX_NAME);
  ok('sanitize: empty name keeps the default', sanitizeLoadout({ name: '   ' }).name === DEFAULT_LOADOUT.name);
  const wished: Loadout = { ...DEFAULT_LOADOUT, head: 'aegis', armor: 'vanguard', back: 'wings', weapon: 'lance', aura: 'nebula' };
  const low = effectiveLoadout(wished, 0);
  ok('effective: locked parts fall back to free defaults', SLOTS.every((s) => low[s] === DEFAULT_LOADOUT[s]));
  const high = effectiveLoadout(wished, 3000);
  ok('effective: unlocked parts are kept', SLOTS.every((s) => high[s] === wished[s]));
  const mid = effectiveLoadout(wished, 1500);
  ok('effective: mixed level keeps only what is unlocked', mid.head === DEFAULT_LOADOUT.head && mid.back === DEFAULT_LOADOUT.back);
  let sane = true;
  for (let i = 0; i < 300; i++) {
    const l = randomLoadout(1250, Math.random);
    SLOTS.forEach((s) => { const p = findPart(s, l[s]); if (!p || !isPartUnlocked(p, 1250)) sane = false; });
    if (!ACCENTS.some((a) => a.id === l.accent) || !BODY_STYLES.includes(l.style)) sane = false;
  }
  ok('random: "surprise me" never picks a locked part', sane);
}

// ── 4. Evolution timeline ────────────────────────────────────────────────────
{
  const ms = buildMilestones();
  ok('timeline: sorted and unique', ms.every((m, i) => i === 0 || m.level > ms[i - 1].level));
  ok('timeline: contains every badge and title level', BADGES.every((b) => ms.some((m) => m.level === b.levelRequired)) && TITLES.filter((t) => t.id !== 'collector').every((t) => ms.some((m) => m.level === t.levelRequired)));
  ok('timeline: no skins and no collector title (the engine does not grant them by level)', ms.every((m) => !('skins' in m)) && ms.every((m) => m.titles.every((t) => t.id !== 'collector')));
  ok('timeline: every gated part appears once', PARTS.filter((p) => p.levelRequired > 0).every((p) => ms.filter((m) => m.parts.includes(p)).length === 1));
  for (const lvl of [0, 999, 1000, 1700, 2500, 9999]) {
    const st = statusOf(ms, lvl);
    ok(`timeline: statuses at level ${lvl} are coherent`, st.filter((s) => s === 'next').length <= 1 && st.every((s, i) => (s === 'reached') === (ms[i].level <= lvl)));
  }
}

// ── 5. Every part visibly changes the figure; nothing throws ─────────────────
{
  const render = (l: Loadout, skin = 'default', level = 0) => renderToStaticMarkup(createElement(NvultFigure, { loadout: l, skinId: skin, level, still: true, label: 'x' }));
  const base = render(DEFAULT_LOADOUT);
  let allDistinct = true;
  for (const slot of SLOTS) {
    const outs = partsFor(slot).map((p) => render({ ...DEFAULT_LOADOUT, [slot]: p.id }));
    if (new Set(outs).size !== outs.length) { allDistinct = false; console.log('   not distinct in slot', slot); }
  }
  ok('figure: every part of every slot renders differently', allDistinct);
  ok('figure: renders without throwing for all styles, finishes and tiers', (() => { try { for (const s of BODY_STYLES) for (const f of Object.keys(FINISHES)) for (const lv of TIER_LEVELS) render({ ...DEFAULT_LOADOUT, style: s }, f, lv); return true; } catch (e) { console.log(e); return false; } })());
  ok('figure: skin finish changes the metal colours', render(DEFAULT_LOADOUT, 'gold') !== render(DEFAULT_LOADOUT, 'default'));
  ok('figure: accent changes the colours', render({ ...DEFAULT_LOADOUT, accent: 'rose' }) !== base);
  ok('figure: body style changes the silhouette', new Set(BODY_STYLES.map((s) => render({ ...DEFAULT_LOADOUT, style: s }))).size === 3);
  ok('figure: higher tier adds detail', render(DEFAULT_LOADOUT, 'default', 2600).length > base.length);
  ok('figure: accessible name is exposed', render(DEFAULT_LOADOUT).includes('aria-label="x"') && render(DEFAULT_LOADOUT).includes('role="img"'));
  ok('figure: unique gradient ids per instance (no cross-talk)', (() => { const two = renderToStaticMarkup(createElement('div', null, createElement(NvultFigure, { loadout: DEFAULT_LOADOUT, skinId: 'gold', level: 0, still: true, label: 'a' }), createElement(NvultFigure, { loadout: DEFAULT_LOADOUT, skinId: 'silver', level: 0, still: true, label: 'b' }))); const ids = [...two.matchAll(/id="([^"]+-metal)"/g)].map((m) => m[1]); return ids.length === 2 && ids[0] !== ids[1]; })());
}

// ── 6. Nine languages: complete, consistent, non-empty ───────────────────────
{
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
  const files = [...walk(join(root, 'src/profile')), join(root, 'src/components/ProfileView.tsx')];
  const used = new Set<string>();
  const dynamicPrefixes = new Set<string>();
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/['"`](pf\.[A-Za-z0-9_.${}\-]+)['"`]/g)) { m[1].includes('${') ? dynamicPrefixes.add(m[1].replace(/\$\{.*$/, '')) : used.add(m[1]); }
  }
  const expand = (prefix: string): string[] => {
    switch (prefix) {
      case 'pf.accent.': return ACCENTS.map((a) => prefix + a.id);
      case 'pf.col.filter.': return ['all', 'owned', 'locked'].map((x) => prefix + x);
      case 'pf.ev.': return ['reached', 'next', 'upcoming'].map((x) => prefix + x);
      case 'pf.nav.': return ['identity', 'nvult', 'collection', 'achievements', 'ranking', 'shop'].map((x) => prefix + x);
      case 'pf.part.': return PARTS.map((p) => `${prefix}${p.slot}.${p.id}`);
      case 'pf.slot.': return [...SLOTS, 'look'].map((x) => prefix + x);
      case 'pf.style.': return BODY_STYLES.map((x) => prefix + x);
      case 'pf.rarity.': return RARITIES.map((x) => prefix + x);
      case 'pf.tag.': case 'pf.tagHint.': return ['live', 'local', 'soon'].map((x) => prefix + x);
      case 'pf.tier.': return TIER_IDS.map((_, i) => prefix + i);
      default: return [];
    }
  };
  const needed = new Set<string>(used);
  let unknownDynamic = false;
  for (const pre of dynamicPrefixes) { const e = expand(pre); if (e.length === 0) { unknownDynamic = true; console.log('   unknown dynamic prefix', pre); } e.forEach((k) => needed.add(k)); }
  ok('i18n: every dynamic key pattern in the code is understood by the test', !unknownDynamic);
  const dicts = buildProfileDicts();
  const missing: string[] = [];
  for (const k of needed) for (const l of LOCALES) if (!dicts[l][k]) missing.push(`${l}:${k}`);
  ok(`i18n: all ${needed.size} referenced pf.* keys exist in all 9 locales`, missing.length === 0, missing.join(' '));
  const unused = PROFILE_KEYS.filter((k) => !needed.has(k));
  ok(`i18n: no dead keys in the dictionary (${PROFILE_KEYS.length} keys, ${unused.length} unused)`, unused.length === 0, unused.join(' '));
  ok('i18n: no duplicate keys', new Set(PROFILE_KEYS).size === PROFILE_KEYS.length);
  const ph = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join('');
  const badPh = PROFILE_KEYS.filter((k) => LOCALES.some((l) => ph(dicts[l][k]) !== ph(dicts.en[k])));
  ok('i18n: placeholders ({n}, {total}, {l}) match in every locale', badPh.length === 0, badPh.slice(0, 5).join(' '));
  ok('i18n: no empty strings and no leaked English-only gaps in key metadata', LOCALES.every((l) => PROFILE_KEYS.every((k) => dicts[l][k].trim().length > 0)));
  ok('i18n: Chinese/Japanese/Korean/Hindi/Arabic strings are really translated (non-ASCII)', (['zh', 'ja', 'ko', 'hi', 'ar'] as const).every((l) => PROFILE_KEYS.filter((k) => !['pf.nav.nvult', 'pf.slot.aura'].includes(k)).filter((k) => !/[^\u0000-\u007f]/.test(dicts[l][k])).length === 0));
}

// ── 7. Honesty and protection of the real systems ────────────────────────────
{
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
  const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const code = [...walk(join(root, 'src/profile')), join(root, 'src/components/ProfileView.tsx')].map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n');
  ok('honesty: no fictional currency or demo balance in the Profile code', !/\bNvA\b|setBalance|\bbalance\b|demo balance|fict/i.test(code));
  ok('honesty: no mock purchase path (purchases only call the real handlers)', !/setOwned|simulate|mockBuy/i.test(code));
  ok('honesty: Nvult loadout is stored only in localStorage (no network)', !/fetch\(|XMLHttpRequest|supabase/i.test(readFileSync(join(root, 'src/profile/nvult/loadout.ts'), 'utf8')));
  let git = true; const sh = (c: string) => { try { return execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { git = false; return ''; } };
  const base = '1e8a958';
  if (sh(`git cat-file -t ${base}`).trim() === 'commit') {
    for (const f of ['src/lib/gamification.ts', 'src/hooks/useGamification.ts', 'src/hooks/usePurchases.ts', 'src/lib/payments.ts']) {
      ok(`protected: ${f} is identical to main ${base}`, sh(`git diff --name-only ${base} -- ${f}`).trim() === '');
    }
    const props = (txt: string) => (txt.match(/interface ProfileViewProps \{[\s\S]*?\n\}/)?.[0] ?? '').replace(/\s+/g, ' ');
    ok('protected: ProfileView props contract is unchanged (same as App.tsx passes)', props(sh(`git show ${base}:artifacts/next-vault-v3/src/components/ProfileView.tsx`)) === props(readFileSync(join(root, 'src/components/ProfileView.tsx'), 'utf8')) && props(readFileSync(join(root, 'src/components/ProfileView.tsx'), 'utf8')).length > 100);
  } else if (!git) { console.log('SKIP protected-file checks (git history not available)'); }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
