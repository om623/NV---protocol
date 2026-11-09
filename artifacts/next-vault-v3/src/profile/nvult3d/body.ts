import * as THREE from 'three';
import { Disposer, type Kit, rbox, prism, tube, cyl, sph, tor, mesh, glowSprite, disposeObject, smooth, TAU } from './primitives';

/** The articulated skeleton plus the base armour. Parts (head gear, weapons, wings...) attach to its anchors. */
export interface Rig {
  root: THREE.Group;
  torso: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  capL: THREE.Group;
  capR: THREE.Group;
  forearmL: THREE.Group;
  forearmR: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  weaponAnchor: THREE.Group;
  backAnchor: THREE.Group;
  headTop: THREE.Group;
  core: THREE.Object3D;
  height: number;
  setStyle(style: 'sleek' | 'classic' | 'heavy'): void;
  setArmed(armed: boolean, instant: boolean): void;
  update(t: number, dt: number, still: boolean): void;
  dispose(): void;
}

const HEAD = 1.18; // the head reads as a character's face, not a helmet on a shield
const STYLE = { sleek: { x: 0.9, z: 0.94, limb: 0.94 }, classic: { x: 1, z: 1, limb: 1 }, heavy: { x: 1.13, z: 1.1, limb: 1.1 } } as const;

export function buildBody(kit: Kit): Rig {
  const d = new Disposer();
  const { mats, q } = kit;
  const s = q.segments;
  const A = mats.armor;
  const T = mats.trim;
  const D = mats.dark;
  const AC = mats.accent;
  const grp = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const put = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = mesh(geo, mat, x, y, z);
    parent.add(m);
    return m;
  };
  const line = (parent: THREE.Object3D, pts: Array<[number, number, number]>, r = 0.006) =>
    put(parent, tube(d, pts.map((p) => new THREE.Vector3(...p)), r, 14, 4), mats.conduit);

  const root = new THREE.Group();
  const pelvis = grp(root, 0, 1.0, 0);
  const spine = grp(pelvis, 0, 0.08, 0);
  const torso = grp(spine, 0, 0.04, 0);

  // ── pelvis ─────────────────────────────────────────────────────────────────────────────────────────────
  put(pelvis, rbox(d, 0.44, 0.17, 0.27, 0.03), T);
  put(pelvis, rbox(d, 0.2, 0.1, 0.05, 0.02), A, 0, -0.01, 0.15);
  put(pelvis, rbox(d, 0.055, 0.045, 0.02, 0.008), AC, 0, -0.01, 0.185);
  for (const sx of [-1, 1]) put(pelvis, rbox(d, 0.13, 0.19, 0.29, 0.035), A, sx * 0.17, -0.01, 0);
  put(pelvis, rbox(d, 0.18, 0.1, 0.06, 0.02), D, 0, -0.1, 0.1);

  // ── abdomen (ribbed) ───────────────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < 3; i++) put(spine, cyl(d, 0.118 - i * 0.004, 0.124, 0.045, s), i % 2 ? T : D, 0, 0.035 + i * 0.05, 0);

  // ── chest ──────────────────────────────────────────────────────────────────────────────────────────────
  const chest = grp(torso, 0, 0.22, 0);
  const chestPts: Array<[number, number]> = [[-0.15, -0.17], [0.15, -0.17], [0.225, 0.0], [0.26, 0.15], [0.17, 0.25], [-0.17, 0.25], [-0.26, 0.15], [-0.225, 0.0]];
  put(chest, prism(d, chestPts, 0.27, 0.03), A);
  put(chest, prism(d, chestPts.map(([x, y]) => [x * 0.74, y * 0.74 - 0.01] as [number, number]), 0.04, 0.008), D, 0, 0, 0.125);
  for (const sx of [-1, 1]) {
    const pec = put(chest, rbox(d, 0.17, 0.09, 0.035, 0.015), A, sx * 0.11, 0.13, 0.145);
    pec.rotation.z = -sx * 0.2;
  }
  const ring = put(chest, tor(d, 0.062, 0.011, s), AC, 0, 0.04, 0.145);
  const core = put(chest, d.geo(new THREE.OctahedronGeometry(0.042, 0)), AC, 0, 0.04, 0.152);
  core.scale.set(1, 1.35, 0.7);
  const coreGlow = glowSprite(kit, 0.55, 0.9);
  coreGlow.position.set(0, 0.04, 0.19);
  chest.add(coreGlow);
  put(chest, rbox(d, 0.2, 0.05, 0.18, 0.02), T, 0, 0.27, 0);
  put(chest, rbox(d, 0.3, 0.28, 0.07, 0.02), T, 0, 0.07, -0.15);
  for (const sx of [-1, 1]) put(chest, rbox(d, 0.05, 0.2, 0.05, 0.012), D, sx * 0.09, 0.08, -0.195);
  line(chest, [[0, -0.02, 0.165], [0, -0.1, 0.17], [0, -0.17, 0.15]], 0.007);
  line(chest, [[-0.18, 0.15, 0.14], [-0.16, 0.02, 0.15], [-0.11, -0.1, 0.14]], 0.005);
  line(chest, [[0.18, 0.15, 0.14], [0.16, 0.02, 0.15], [0.11, -0.1, 0.14]], 0.005);

  // ── neck + head ────────────────────────────────────────────────────────────────────────────────────────
  const neck = grp(torso, 0, 0.5, 0);
  for (let i = 0; i < 2; i++) put(neck, cyl(d, 0.05, 0.055, 0.045, s), i ? T : D, 0, 0.02 + i * 0.045, 0);
  put(neck, cyl(d, 0.11, 0.135, 0.04, s), A, 0, -0.01, 0);
  const head = grp(neck, 0, 0.235, 0);
  const headPts: Array<[number, number]> = [[-0.09, 0.165], [0.09, 0.165], [0.125, 0.095], [0.14, -0.02], [0.11, -0.12], [0, -0.165], [-0.11, -0.12], [-0.14, -0.02], [-0.125, 0.095]];
  put(head, prism(d, headPts, 0.27, 0.02), A);
  put(head, prism(d, [[-0.112, 0.055], [0.112, 0.055], [0.124, -0.02], [0.095, -0.078], [-0.095, -0.078], [-0.124, -0.02]], 0.03, 0.006), mats.visor, 0, 0, 0.128);
  for (const sx of [-1, 1]) {
    put(head, rbox(d, 0.068, 0.014, 0.012, 0.005), mats.eye, sx * 0.052, 0.004, 0.147);
    const g = glowSprite(kit, 0.17, 0.85, true);
    g.position.set(sx * 0.052, 0.004, 0.16);
    const gm = (g as THREE.Sprite).material as THREE.SpriteMaterial | undefined; // absent on the low tier (no glow sprites)
    if (gm) mats.followAccent(gm);
    head.add(g);
    put(head, cyl(d, 0.045, 0.045, 0.03, 8), T, sx * 0.145, 0.0, -0.01).rotation.z = Math.PI / 2;
    put(head, sph(d, 0.012, 8), AC, sx * 0.163, 0.0, -0.01);
  }
  const brow = put(head, rbox(d, 0.23, 0.03, 0.06, 0.012), A, 0, 0.098, 0.128);
  brow.rotation.x = 0.28;
  for (const sx of [-1, 1]) {
    put(head, rbox(d, 0.03, 0.1, 0.13, 0.01), T, sx * 0.135, -0.05, 0.05);
    put(head, rbox(d, 0.012, 0.05, 0.02, 0.004), AC, sx * 0.152, -0.055, 0.1);
  }
  put(head, rbox(d, 0.05, 0.12, 0.06, 0.012), D, 0, 0.0, -0.14);
  const scan = put(head, rbox(d, 0.012, 0.07, 0.012, 0.004), mats.energy, 0, 0.004, 0.149);
  put(head, prism(d, [[-0.05, 0], [0.05, 0], [0, -0.05]], 0.06, 0.008), T, 0, -0.125, 0.1);
  const headTop = grp(head, 0, 0.17, 0);

  // ── arms ───────────────────────────────────────────────────────────────────────────────────────────────
  const arm = (sx: number) => {
    const shoulder = grp(torso, sx * 0.335, 0.43, 0);
    put(shoulder, sph(d, 0.075, s), T);
    const cap = grp(shoulder, 0, 0.015, 0);
    const shell = put(cap, d.geo(new THREE.SphereGeometry(0.118, s, Math.max(6, s >> 1), 0, TAU, 0, Math.PI / 2)), A);
    shell.scale.set(1, 0.85, 1.12);
    shell.rotation.z = -sx * 0.22;
    put(cap, tor(d, 0.115, 0.005, s), AC, 0, 0.0, 0).rotation.x = Math.PI / 2;
    put(shoulder, cyl(d, 0.05, 0.045, 0.27, s), T, 0, -0.14, 0);
    const sleeve = put(shoulder, cyl(d, 0.06, 0.054, 0.19, s), A, 0, -0.12, 0);
    sleeve.scale.set(1, 1, 1.05);
    line(shoulder, [[0, -0.04, 0.056], [0, -0.14, 0.064], [0, -0.25, 0.052]], 0.006);
    const elbow = grp(shoulder, 0, -0.27, 0);
    put(elbow, sph(d, 0.053, s), T);
    put(elbow, tor(d, 0.054, 0.007, s), AC).rotation.y = Math.PI / 2;
    const fore = grp(elbow, 0, 0, 0);
    put(fore, cyl(d, 0.048, 0.036, 0.26, s), T, 0, -0.14, 0);
    put(fore, rbox(d, 0.1, 0.17, 0.1, 0.025), A, 0, -0.12, 0.005);
    line(fore, [[0, -0.04, 0.056], [0, -0.14, 0.052], [0, -0.25, 0.04]], 0.005);
    const wrist = grp(fore, 0, -0.27, 0);
    put(wrist, tor(d, 0.038, 0.008, s), AC).rotation.x = Math.PI / 2;
    put(wrist, rbox(d, 0.07, 0.09, 0.055, 0.014), A, 0, -0.055, 0);
    for (let i = -1; i <= 1; i++) put(wrist, rbox(d, 0.016, 0.05, 0.016, 0.005), T, i * 0.022, -0.125, 0.012);
    put(wrist, rbox(d, 0.016, 0.045, 0.02, 0.005), T, -sx * 0.043, -0.07, 0.016);
    return { shoulder, cap, elbow, fore, wrist };
  };
  const L = arm(-1);
  const R = arm(1);
  const weaponAnchor = grp(R.wrist, 0, -0.07, 0.0);
  weaponAnchor.rotation.x = Math.PI / 2;

  const backAnchor = grp(chest, 0, 0.1, -0.21);

  // ── legs ───────────────────────────────────────────────────────────────────────────────────────────────
  const leg = (sx: number) => {
    const hip = grp(pelvis, sx * 0.13, -0.06, 0);
    put(hip, sph(d, 0.082, s), D);
    put(hip, cyl(d, 0.095, 0.07, 0.44, s), T, 0, -0.22, 0);
    put(hip, rbox(d, 0.145, 0.3, 0.13, 0.035), A, 0, -0.2, 0.04);
    put(hip, rbox(d, 0.03, 0.26, 0.1, 0.01), A, sx * 0.082, -0.2, 0);
    line(hip, [[0, -0.07, 0.1], [0, -0.22, 0.102], [0, -0.37, 0.085]], 0.006);
    const knee = grp(hip, 0, -0.44, 0);
    const kg = put(knee, cyl(d, 0.075, 0.075, 0.1, 6), T);
    kg.rotation.z = Math.PI / 2;
    const cap = put(knee, sph(d, 0.07, s), A, 0, 0, 0.045);
    cap.scale.set(1, 1, 0.7);
    put(knee, tor(d, 0.05, 0.006, s), AC, 0, 0, 0.075);
    put(knee, cyl(d, 0.072, 0.056, 0.37, s), T, 0, -0.2, 0);
    put(knee, prism(d, [[-0.065, 0.14], [0.065, 0.14], [0.052, -0.14], [-0.052, -0.14]], 0.13, 0.016), A, 0, -0.2, 0.05);
    const calf = put(knee, sph(d, 0.078, s), A, 0, -0.12, -0.05);
    calf.scale.set(1, 1.3, 0.8);
    const ankle = grp(knee, 0, -0.37, 0);
    put(ankle, sph(d, 0.052, s), D);
    put(ankle, tor(d, 0.062, 0.012, s), A, 0, 0.02, 0).rotation.x = Math.PI / 2;
    put(ankle, rbox(d, 0.14, 0.08, 0.3, 0.028), A, 0, -0.07, 0.06);
    put(ankle, prism(d, [[-0.05, 0], [0.05, 0], [0.03, 0.09], [-0.03, 0.09]], 0.05, 0.01), T, 0, -0.09, 0.2).rotation.x = Math.PI / 2;
    put(ankle, rbox(d, 0.08, 0.012, 0.02, 0.004), AC, 0, -0.045, -0.1);
    return hip;
  };
  const hipL = leg(-1);
  const hipR = leg(1);

  // ── pose / idle ────────────────────────────────────────────────────────────────────────────────────────
  let armW = 0;
  let armedTarget = 0;
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

  function applyPose(t: number) {
    const br = Math.sin(t * 1.5);
    pelvis.position.y = 1.0 + 0.006 * br;
    pelvis.rotation.z = 0.014 * Math.sin(t * 0.7);
    pelvis.rotation.y = 0.03 * Math.sin(t * 0.45);
    spine.rotation.x = 0.012 * br;
    torso.rotation.y = 0.035 * Math.sin(t * 0.45 + 0.6);
    neck.rotation.y = 0.06 * Math.sin(t * 0.6);
    head.rotation.y = 0.14 * Math.sin(t * 0.5 + 1) + 0.06 * Math.sin(t * 1.31);
    head.rotation.x = 0.035 * Math.sin(t * 0.8) - 0.02;
    L.shoulder.rotation.z = -0.12 - 0.025 * Math.sin(t * 1.5 + 0.5);
    L.shoulder.rotation.x = 0.03 * Math.sin(t * 1.2);
    L.elbow.rotation.x = -0.18 + 0.03 * Math.sin(t * 1.3);
    R.shoulder.rotation.z = lerp(0.12 + 0.025 * Math.sin(t * 1.5 + 2), 0.16, armW);
    R.shoulder.rotation.x = lerp(0.03 * Math.sin(t * 1.2 + 1), -0.32, armW);
    R.elbow.rotation.x = lerp(-0.18 + 0.03 * Math.sin(t * 1.3 + 1), -1.12, armW);
    hipL.rotation.z = -0.03;
    hipR.rotation.z = 0.03;
    hipL.rotation.x = 0.02 * Math.sin(t * 0.7);
    hipR.rotation.x = -0.02 * Math.sin(t * 0.7);
    const pulse = 1 + 0.07 * Math.sin(t * 2.4);
    core.scale.set(pulse, 1.35 * pulse, 0.7 * pulse);
    ring.rotation.z = t * 0.8;
    coreGlow.scale.setScalar(0.55 * (1 + 0.1 * Math.sin(t * 2.4)));
    scan.position.x = 0.085 * Math.sin(t * 1.4);
  }

  const rig: Rig = {
    root, torso, pelvis, spine, chest, neck, head,
    shoulderL: L.shoulder, shoulderR: R.shoulder, capL: L.cap, capR: R.cap, forearmL: L.fore, forearmR: R.fore,
    hipL, hipR, weaponAnchor, backAnchor, headTop, core, height: 2.04,
    setStyle(style) {
      const st = STYLE[style] ?? STYLE.classic;
      torso.scale.set(st.x, 1, st.z);
      head.scale.set(HEAD / st.x, HEAD, HEAD / st.z);
      hipL.scale.set(st.limb, 1, st.limb);
      hipR.scale.set(st.limb, 1, st.limb);
    },
    setArmed(armed, instant) {
      armedTarget = armed ? 1 : 0;
      if (instant) armW = armedTarget;
    },
    update(t, dt, still) {
      armW = smooth(armW, armedTarget, 6, dt);
      applyPose(still ? 0 : t);
    },
    dispose() {
      disposeObject(root, kit);
      d.dispose();
      root.removeFromParent();
    },
  };
  rig.setStyle('classic');
  applyPose(0);
  return rig;
}
