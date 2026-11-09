// Nvult 3D logic tests (no WebGL needed). Run: bun run scripts/profile-3d-tests.ts
import * as THREE from 'three';
import { PARTS, SLOTS, ACCENTS, BODY_STYLES, TIER_LEVELS, tierOf } from '../src/profile/nvult/catalog';
import { Mats, FINISH3D, finish3d } from '../src/profile/nvult3d/materials';
import { buildBody, type Rig } from '../src/profile/nvult3d/body';
import { GEAR } from '../src/profile/nvult3d/partsGear';
import { GEAR_B } from '../src/profile/nvult3d/partsGearB';
import { buildPart, buildTierFx, type SlotId } from '../src/profile/nvult3d/parts';
import { FOV, FRAME_LIFT, FRAME_ZOOM, frameFor } from '../src/profile/nvult3d/framing';
import { Textures, type Kit } from '../src/profile/nvult3d/primitives';
import { PROFILES, QUALITY_KEY, chooseRenderMode, detectEnv, downgrade, readQualityPref, resolveTier, writeQualityPref, type Env, type QualityTier } from '../src/profile/nvult3d/support';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`); };

const makeKit = (tier: QualityTier = 'high') => { const tex = new Textures(); const mats = new Mats(tex); const kit: Kit = { mats, q: PROFILES[tier], tex }; return kit; };
const NO_GEOMETRY: Record<string, string> = { head: 'standard', armor: 'core', back: 'none', weapon: 'none', aura: 'none' }; // ids that add nothing on purpose
const world = (rig: Rig) => { const tt = new THREE.Group(); tt.add(rig.root); tt.updateMatrixWorld(true); return tt; };
const tris = (o: THREE.Object3D) => { let n = 0; o.traverse((m) => { const g = (m as THREE.Mesh).geometry as THREE.BufferGeometry | undefined; if ((m as THREE.Mesh).isMesh && g) n += (g.index ? g.index.count : g.attributes.position.count) / 3; }); return Math.round(n); };
const renderable = (o: THREE.Object3D) => { let n = tris(o); o.traverse((m) => { const pts = m as THREE.Points; if (pts.isPoints) n += pts.geometry.attributes.position.count; if ((m as THREE.Sprite).isSprite) n += 1; }); return n; };
const count = (o: THREE.Object3D) => { let n = 0; o.traverse(() => n++); return n; };
const box = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

// ── 1. The 3D catalogue matches the product catalogue, both ways ─────────────
{
  const catalog = new Set(PARTS.map((p) => `${p.slot}:${p.id}`));
  const builders = new Set<string>();
  for (const [slot, table] of Object.entries({ ...GEAR, ...GEAR_B })) for (const id of Object.keys(table)) builders.add(`${slot}:${id}`);
  const missing = [...catalog].filter((k) => !builders.has(k));
  const orphans = [...builders].filter((k) => !catalog.has(k));
  ok(`catalogue: every one of the ${catalog.size} parts has a 3D builder`, missing.length === 0, missing.join(' '));
  ok('catalogue: no 3D builder exists for a part the product does not offer', orphans.length === 0, orphans.join(' '));
}

// ── 2. Every part builds, adds real geometry, differs from its siblings, and disposes cleanly ──
{
  const kit = makeKit(); const rig = buildBody(kit); const tt = world(rig); const baseline = count(rig.root);
  const sig = new Map<string, string>(); let built = 0, empty = 0, bad: string[] = [], leaks: string[] = [], deform: string[] = [];
  for (const p of PARTS) {
    let inst: ReturnType<typeof buildPart>;
    try { inst = buildPart(p.slot as SlotId, p.id, kit, rig, tt); } catch (e) { bad.push(`${p.slot}:${p.id} threw ${(e as Error).message}`); continue; }
    if (!inst) { if (NO_GEOMETRY[p.slot] === p.id) empty++; else bad.push(`${p.slot}:${p.id} built nothing`); continue; }
    built++; tt.updateMatrixWorld(true);
    let t = 0, m = 0; const geos: THREE.BufferGeometry[] = [];
    for (const o of inst.objects) o.traverse((n) => { const mesh = n as THREE.Mesh; if (mesh.isMesh) { m++; geos.push(mesh.geometry); } });
    for (const o of inst.objects) t += tris(o);
    if (t === 0 && inst.objects.reduce((n, o) => n + renderable(o), 0) === 0) bad.push(`${p.slot}:${p.id} renders nothing`);
    if (!inst.objects.every((o) => Number.isFinite(o.scale.x) && o.scale.x > 0)) deform.push(`${p.slot}:${p.id}`);
    sig.set(`${p.slot}:${p.id}`, `${p.slot}|${m}|${t}|${inst.objects.reduce((n, o) => n + renderable(o), 0)}`);
    let fired = 0; geos.forEach((g) => g.addEventListener('dispose', () => fired++));
    inst.dispose(); tt.updateMatrixWorld(true);
    if (count(rig.root) !== baseline) leaks.push(`${p.slot}:${p.id} left ${count(rig.root) - baseline} nodes`);
    if (fired < geos.length) leaks.push(`${p.slot}:${p.id} geometries ${fired}/${geos.length}`);
  }
  ok(`parts: ${built} builders produce geometry, ${empty} intentionally add nothing, none throws`, bad.length === 0, bad.join(' | '));
  ok('parts: every part has valid scale', deform.length === 0, deform.join(' '));
  ok('parts: dispose removes every node and frees every geometry (no leaks)', leaks.length === 0, leaks.join(' | '));
  const dup = [...sig.values()].filter((v, i, a) => a.indexOf(v) !== i);
  ok('parts: no two parts of a slot are the same shape (each one visibly differs)', dup.length === 0, dup.join(' '));
  rig.dispose();
}

// ── 3. The body: proportions, grounding, symmetry, style ──────────────────────
{
  const kit = makeKit(); const rig = buildBody(kit); const tt = world(rig); rig.update(0, 0.016, true);
  const b = box(rig.root); const h = b.max.y - b.min.y;
  ok(`body: heroic humanoid height (${h.toFixed(2)} m)`, h > 1.85 && h < 2.2);
  ok('body: feet rest on the pedestal (y = 0)', Math.abs(b.min.y) < 0.03, `min y ${b.min.y.toFixed(3)}`);
  ok('body: left/right symmetric within 3%', Math.abs(b.max.x + b.min.x) < 0.03 * (b.max.x - b.min.x), `x ${b.min.x.toFixed(3)}..${b.max.x.toFixed(3)}`);
  const widths = BODY_STYLES.map((s) => { rig.setStyle(s); tt.updateMatrixWorld(true); const w = box(rig.torso); return w.max.x - w.min.x; });
  ok('body: sleek < classic < heavy (torso width)', widths[0] < widths[1] && widths[1] < widths[2], widths.map((x) => x.toFixed(2)).join(' < '));
  const headW = BODY_STYLES.map((s) => { rig.setStyle(s); tt.updateMatrixWorld(true); const w = box(rig.head); return w.max.x - w.min.x; });
  ok('body: head keeps its size whatever the body style', Math.max(...headW) / Math.min(...headW) < 1.03);
  rig.setStyle('classic'); rig.setArmed(false, true); rig.update(0, 0.016, true); tt.updateMatrixWorld(true);
  const rest = new THREE.Vector3(); rig.weaponAnchor.getWorldPosition(rest);
  rig.setArmed(true, true); rig.update(0, 0.016, true); tt.updateMatrixWorld(true);
  const held = new THREE.Vector3(); rig.weaponAnchor.getWorldPosition(held);
  ok('body: holding a weapon brings the right hand forward and up', held.z > rest.z + 0.2 && held.y > rest.y + 0.1, `hand z ${rest.z.toFixed(2)} -> ${held.z.toFixed(2)}, y ${rest.y.toFixed(2)} -> ${held.y.toFixed(2)}`);
  rig.update(0, 0.016, false); const y0 = rig.head.rotation.y; rig.update(2.1, 0.016, false);
  ok('animation: idle moves the head over time', Math.abs(rig.head.rotation.y - y0) > 0.001);
  rig.update(0, 0.016, true); const s0 = rig.head.rotation.y; rig.update(2.1, 0.016, true);
  ok('animation: reduced motion (still) holds the pose', rig.head.rotation.y === s0);
  rig.dispose();
}

// ── 4. Weapons: the scale agreed with the user, mounted in the hand ───────────
{
  const kit = makeKit(); const rig = buildBody(kit); const tt = world(rig); rig.setArmed(true, true); rig.update(0, 0.016, true); tt.updateMatrixWorld(true);
  const H = box(rig.root).max.y - box(rig.root).min.y; const anchor = new THREE.Vector3(); rig.weaponAnchor.getWorldPosition(anchor);
  const r: Record<string, { scale: number; ratio: number; off: number }> = {};
  for (const id of ['blade', 'staff', 'lance']) {
    const inst = buildPart('weapon', id, kit, rig, tt)!; tt.updateMatrixWorld(true); const g = inst.objects[0]; const bb = box(g);
    const p = new THREE.Vector3(); g.getWorldPosition(p);
    r[id] = { scale: g.scale.x, ratio: Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) / H, off: p.distanceTo(anchor) }; inst.dispose();
  }
  ok('weapons: Plasma Blade untouched (scale 1)', r.blade.scale === 1);
  ok('weapons: Arc Staff and Data Lance at the agreed 0.75', r.staff.scale === 0.75 && r.lance.scale === 0.75);
  ok('weapons: all three stay exactly in the hand (grip offset 0)', Object.values(r).every((x) => x.off < 1e-6));
  ok('weapons: staff and lance no longer exceed 80% of the body height', r.staff.ratio < 0.8 && r.lance.ratio < 0.8, `staff ${(r.staff.ratio * 100).toFixed(0)}% lance ${(r.lance.ratio * 100).toFixed(0)}%`);
  ok('weapons: order blade < staff < lance', r.blade.ratio < r.staff.ratio && r.staff.ratio < r.lance.ratio);
  rig.dispose();
}

// ── 5. Camera framing: the whole character, every part, fits the 4:5 stage ───
{
  const kit = makeKit(); const rig = buildBody(kit); const tt = world(rig); rig.setArmed(true, true); rig.update(0, 0.016, true);
  const margins = (aspect: number) => {
    const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 40); const f = frameFor(aspect); cam.position.set(...f.position); cam.lookAt(...f.target); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    let top = -9, bot = 9, side = 0; const v = new THREE.Vector3();
    for (const yaw of [0, 0.4, -0.4, 1.57, 3.14, 4.71]) { tt.rotation.y = yaw; tt.updateMatrixWorld(true);
      rig.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const a = m.geometry.attributes.position; const step = Math.max(1, Math.floor(a.count / 300));
        for (let i = 0; i < a.count; i += step) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld).project(cam); top = Math.max(top, v.y); bot = Math.min(bot, v.y); side = Math.max(side, Math.abs(v.x)); } }); }
    tt.rotation.y = 0; tt.updateMatrixWorld(true);
    return { top: (1 - top) / 2 * 100, bot: (bot + 1) / 2 * 100, side: (1 - side) / 2 * 100 };
  };
  let worst = { top: 99, side: 99, bot: 99, name: '' };
  const looks: Array<[string, Array<[SlotId, string]>]> = [['bare', []], ...PARTS.filter((p) => NO_GEOMETRY[p.slot] !== p.id && p.slot !== 'aura').map((p): [string, Array<[SlotId, string]>] => [`${p.slot}:${p.id}`, [[p.slot as SlotId, p.id]]]),
    ['lance+wings+aegis+vanguard', [['weapon', 'lance'], ['back', 'wings'], ['head', 'aegis'], ['armor', 'vanguard']]], ['staff+crawler+halo+bulwark', [['weapon', 'staff'], ['back', 'crawler'], ['head', 'halo'], ['armor', 'bulwark']]]];
  for (const [name, set] of looks) {
    const insts = set.map(([s, id]) => buildPart(s, id, kit, rig, tt)).filter(Boolean) as NonNullable<ReturnType<typeof buildPart>>[];
    const m = margins(4 / 5); if (m.top < worst.top) worst = { ...worst, top: m.top, name };
    worst.side = Math.min(worst.side, m.side); worst.bot = Math.min(worst.bot, m.bot); insts.forEach((i) => i.dispose());
  }
  ok(`framing: ${looks.length} looks x 6 angles fit with >= 3% headroom (worst ${worst.top.toFixed(2)}% on ${worst.name})`, worst.top >= 3);
  ok(`framing: wings and crawler legs keep >= 2% side margin (worst ${worst.side.toFixed(2)}%)`, worst.side >= 2);
  ok(`framing: feet stay well inside the bottom edge (${worst.bot.toFixed(1)}%)`, worst.bot >= 5);
  ok(`framing: change is small (zoom x${FRAME_ZOOM}, lift ${FRAME_LIFT} m)`, FRAME_ZOOM <= 1.06 && FRAME_LIFT <= 0.15);
  ok('framing: camera still looks at the figure, slightly above its centre', frameFor(0.8).target[1] > 1.1 && frameFor(0.8).position[2] > 5);
  rig.dispose();
}

// ── 6. Materials: finish per skin, smooth transition, accent follow ──────────
{
  const kit = makeKit(); const m = kit.mats;
  const ids = ['default', 'bronze', 'silver', 'gold', 'platinum', 'premium-500', 'premium-1000'];
  ok('finish: every product skin has its own 3D finish', ids.every((i) => i in FINISH3D));
  ok('finish: colours are all different', new Set(ids.map((i) => FINISH3D[i].color)).size === ids.length);
  ok('finish: an unknown skin id falls back to the default steel', finish3d('nope') === FINISH3D.default);
  m.setFinish('gold', true); ok('finish: instant switch lands exactly on the target colour', m.armor.color.getHex() === new THREE.Color(FINISH3D.gold.color).getHex());
  m.setFinish('bronze', false); const c0 = m.armor.color.getHex(); m.tick(0.05);
  const mid = m.armor.color.getHex(); for (let i = 0; i < 80; i++) m.tick(0.05);
  ok('finish: animated switch moves gradually and settles on the target', c0 !== mid && m.armor.color.getHex() === new THREE.Color(FINISH3D.bronze.color).getHex());
  m.setAccent('#fb7185', true); ok('accent: emissive material follows the chosen colour', m.accent.emissive.getHexString() === 'fb7185');
  m.dispose();
}

// ── 7. Evolution tiers ────────────────────────────────────────────────────────
{
  const kit = makeKit(); const rig = buildBody(kit); const tt = world(rig); const before = count(tt); const fx = buildTierFx(kit, rig, tt); const sizes: number[] = [];
  for (let t = 0; t <= 6; t++) { fx.setTier(t); tt.updateMatrixWorld(true); sizes.push(count(tt)); }
  ok('tiers: each evolution step adds visible detail (never removes)', sizes.every((n, i) => i === 0 || n >= sizes[i - 1]) && sizes[6] > sizes[0], sizes.join(','));
  ok('tiers: model tier matches the product thresholds', TIER_LEVELS.every((lvl, i) => tierOf(lvl) === i));
  fx.setTier(6); const full = count(tt); fx.dispose(); tt.updateMatrixWorld(true);
  ok(`tiers: dispose removes every effect (nodes ${full} -> ${count(tt)}, was ${before} before the effects existed)`, count(tt) === before);
  rig.dispose();
}

// ── 8. Quality, capability detection and fallback decision ───────────────────
{
  const env = (o: Partial<Env> = {}): Env => ({ webgl: true, reducedMotion: false, pref: 'auto', coarsePointer: false, memory: 8, cores: 8, dpr: 2, ...o });
  ok('fallback: no WebGL -> simple 2D view', chooseRenderMode(env({ webgl: false })) === '2d');
  ok('fallback: user chose "no 3D" -> simple 2D view even with WebGL', chooseRenderMode(env({ pref: 'off' })) === '2d');
  ok('fallback: WebGL available -> 3D', chooseRenderMode(env()) === '3d');
  ok('motion: reduced motion still gets 3D (it just stays still)', chooseRenderMode(env({ reducedMotion: true })) === '3d');
  ok('quality: capable desktop -> high', resolveTier(env()) === 'high');
  ok('quality: phone (coarse pointer) -> medium', resolveTier(env({ coarsePointer: true })) === 'medium');
  ok('quality: low memory or few cores -> low', resolveTier(env({ memory: 2 })) === 'low' && resolveTier(env({ cores: 2 })) === 'low');
  ok('quality: explicit preference overrides detection', resolveTier(env({ pref: 'low' })) === 'low' && resolveTier(env({ pref: 'high', coarsePointer: true })) === 'high');
  ok('quality: automatic downgrade chain high -> medium -> low -> stop', downgrade('high') === 'medium' && downgrade('medium') === 'low' && downgrade('low') === null);
  const t = (['high', 'medium', 'low'] as QualityTier[]).map((k) => PROFILES[k]);
  ok('quality: profiles get cheaper step by step (pixel ratio, particles, segments)', t[0].dprCap >= t[1].dprCap && t[1].dprCap >= t[2].dprCap && t[0].particles > t[1].particles && t[1].particles > t[2].particles && t[0].segments > t[1].segments && t[1].segments > t[2].segments);
  ok('quality: low tier drops glow sprites and shadows', !PROFILES.low.glow && !PROFILES.low.shadows && PROFILES.high.glow && PROFILES.high.shadows);
  const tri = (tier: QualityTier) => { const kit = makeKit(tier); const rig = buildBody(kit); const tt = world(rig); const ps = [['head', 'aegis'], ['armor', 'vanguard'], ['back', 'wings'], ['weapon', 'lance']].map(([s, i]) => buildPart(s as SlotId, i, kit, rig, tt)); const n = tris(tt); ps.forEach((p) => p?.dispose()); rig.dispose(); return n; };
  const tr = (['high', 'medium', 'low'] as QualityTier[]).map(tri);
  ok(`quality: triangle budget drops per tier (${tr.join(' > ')})`, tr[0] > tr[1] && tr[1] > tr[2]);
  // preference storage, with a fake localStorage
  const store = new Map<string, string>(); (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  ok('preference: default is auto', readQualityPref() === 'auto');
  writeQualityPref('off'); ok('preference: saved and read back', readQualityPref() === 'off' && store.get(QUALITY_KEY) === 'off');
  store.set(QUALITY_KEY, '<script>'); ok('preference: garbage in storage falls back to auto', readQualityPref() === 'auto');
  ok('detectEnv: does not throw outside a browser', typeof detectEnv({ pref: 'auto' }).webgl === 'boolean');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
