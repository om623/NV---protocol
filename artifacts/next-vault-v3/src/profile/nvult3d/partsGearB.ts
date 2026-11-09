import * as THREE from 'three';
import { rbox, prism, tube, cyl, sph, tor, TAU } from './primitives';
import type { PartBuilder } from './partsGear';

type Fn = (b: PartBuilder) => void;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ── BACK (attached to the backpack anchor) ───────────────────────────────────────────────────────────────────

const back: Record<string, Fn> = {
  none: () => {},

  antenna: (b) => {
    const { mats, d } = b;
    const g = b.at(b.c.rig.backAnchor);
    const tips: THREE.Mesh[] = [];
    [[-1, 0.62, 0.36], [1, 0.62, -0.36], [-1, 0.4, 0.62], [1, 0.4, -0.62]].forEach(([sx, h, rot], i) => {
      const x = (sx as number) * (i < 2 ? 0.13 : 0.17);
      const rod = b.put(g, cyl(d, 0.006, 0.011, h as number, 8), mats.trim, x, 0.1 + (h as number) / 2 * Math.cos(rot as number), -0.02);
      rod.rotation.z = rot as number;
      rod.position.x = x + Math.sin(-(rot as number)) * (h as number) * 0.5;
      const tip = b.put(g, sph(d, 0.016, 8), mats.accent, x + Math.sin(-(rot as number)) * (h as number), 0.1 + (h as number) * Math.cos(rot as number), -0.02);
      tips.push(tip);
      b.glow(g, 0.16, tip.position.x, tip.position.y, tip.position.z);
      b.put(g, cyl(d, 0.02, 0.026, 0.03, 8), mats.armor, x, 0.1, -0.02);
    });
    b.tick((t) => tips.forEach((m, i) => m.scale.setScalar(0.85 + 0.35 * Math.max(0, Math.sin(t * 2.4 + i * 1.6)))));
  },

  crawler: (b) => {
    const { mats, d } = b;
    const g = b.at(b.c.rig.backAnchor);
    const legs: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Group();
        const p = [V(sx * 0.12, 0.14 - i * 0.05, -0.03), V(sx * (0.4 + 0.1 * i), 0.4 - i * 0.12, -0.16), V(sx * (0.68 + 0.08 * i), 0.16 - i * 0.18, -0.13 - i * 0.04), V(sx * (0.78 + 0.1 * i), -0.08 - i * 0.2, -0.06)];
        b.put(leg, tube(d, p, 0.016, 18, 6), mats.armor);
        [p[1], p[2]].forEach((q) => b.put(leg, sph(d, 0.024, 8), mats.accent, q.x, q.y, q.z));
        const claw = b.put(leg, d.geo(new THREE.ConeGeometry(0.02, 0.1, 6)), mats.trim, p[3].x, p[3].y - 0.04, p[3].z);
        claw.rotation.z = Math.PI + sx * 0.2;
        g.add(leg);
        legs.push(leg);
      }
    }
    b.tick((t) => legs.forEach((l, i) => (l.rotation.z = 0.025 * Math.sin(t * 1.3 + i * 0.9))));
  },

  wings: (b) => {
    const { mats, d } = b;
    const g = b.at(b.c.rig.backAnchor);
    const L = [0.95, 1.05, 1.0, 0.85, 0.68];
    const A = [0.3, 0.72, 1.12, 1.52, 1.9];
    const blades: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      L.forEach((len, i) => {
        const bl = new THREE.Group();
        bl.position.set(sx * 0.14, 0.12 + i * 0.01, -0.02);
        bl.rotation.set(-0.35, 0, -sx * A[i]);
        const pts: Array<[number, number]> = [[0, 0], [0.045, 0.12 * len], [0.06, 0.62 * len], [0, len], [-0.03, 0.3 * len]];
        b.put(bl, prism(d, pts, 0.016, 0.006), i % 2 ? mats.trim : mats.armor);
        b.put(bl, prism(d, [[0.012, 0.05 * len], [0.034, 0.5 * len], [0.0, 0.94 * len], [-0.01, 0.4 * len]], 0.005, 0.002), mats.glass, 0, 0, 0.011);
        b.put(bl, rbox(d, 0.007, len * 0.9, 0.008, 0.002), mats.energy, 0.012, len * 0.46, 0.014);
        g.add(bl);
        blades.push(bl);
      });
    }
    b.glow(g, 1.5, 0, 0.3, -0.2, 0.2);
    b.tick((t) => blades.forEach((bl, i) => (bl.rotation.x = -0.35 + 0.04 * Math.sin(t * 1.8 + (i % 5) * 0.5))));
  },
};

// ── WEAPON (attached to the right hand; +Y is the weapon's long axis) ───────────────────────────────────────────

/**
 * The two long weapons (Arc Staff, Data Lance) were too big next to the body (25% smaller now; with the old size the lance tip left the stage frame by ~16%). Scaling the whole weapon group uniformly about
 * the grip (the group origin sits in the hand) shrinks every detail in proportion and keeps the hand attachment, the ring
 * rotation, the orb pulse and the pennant wave exactly as designed. The Plasma Blade is deliberately not scaled.
 */
const LONG_WEAPON_SCALE = 0.75;

const weapon: Record<string, Fn> = {
  none: () => {},

  blade: (b) => {
    const { mats, d } = b;
    const g = b.at(b.c.rig.weaponAnchor);
    b.put(g, cyl(d, 0.02, 0.02, 0.2, 10), mats.dark, 0, 0.03, 0);
    b.put(g, rbox(d, 0.15, 0.028, 0.05, 0.01), mats.armor, 0, 0.14, 0);
    b.put(g, sph(d, 0.016, 8), mats.accent, 0, -0.08, 0);
    const pts: Array<[number, number]> = [[-0.036, 0], [0.036, 0], [0.03, 0.8], [0, 0.96], [-0.03, 0.8]];
    const core = b.put(g, prism(d, pts, 0.016, 0.004), mats.energy, 0, 0.16, 0);
    const shellMat = d.mat(new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    mats.followAccent(shellMat);
    const shell = b.put(g, prism(d, pts, 0.02, 0.004), shellMat, 0, 0.16, 0);
    shell.scale.set(2.2, 1.02, 2.4);
    [0.3, 0.65, 1.0].forEach((y) => b.glow(g, 0.5, 0, y, 0, 0.6));
    b.tick((t) => {
      shell.scale.set(2.2 + 0.25 * Math.sin(t * 9), 1.02, 2.4 + 0.3 * Math.sin(t * 7.3));
      core.scale.x = 1 + 0.06 * Math.sin(t * 11);
    });
  },

  staff: (b) => {
    const { mats, d, s } = b;
    const g = b.at(b.c.rig.weaponAnchor);
    g.scale.setScalar(LONG_WEAPON_SCALE);
    b.put(g, cyl(d, 0.019, 0.019, 1.5, 10), mats.trim, 0, 0.5, 0);
    [-0.05, 0.4, 0.95].forEach((y) => b.put(g, tor(d, 0.025, 0.008, s), mats.armor, 0, y, 0).rotation.x = Math.PI / 2);
    const head = new THREE.Group();
    head.position.y = 1.32;
    g.add(head);
    const r1 = b.put(head, tor(d, 0.1, 0.009, s), mats.accent);
    const r2 = b.put(head, tor(d, 0.075, 0.007, s), mats.energy);
    const orb = b.put(head, sph(d, 0.045, s), mats.energy);
    b.glow(head, 0.55, 0, 0, 0);
    b.tick((t) => {
      r1.rotation.set(t * 0.9, t * 0.5, 0);
      r2.rotation.set(0.4, t * 1.3, t * 0.7);
      orb.scale.setScalar(1 + 0.08 * Math.sin(t * 3));
    });
  },

  lance: (b) => {
    const { mats, d } = b;
    const g = b.at(b.c.rig.weaponAnchor);
    g.scale.setScalar(LONG_WEAPON_SCALE);
    b.put(g, cyl(d, 0.017, 0.02, 1.55, 10), mats.armor, 0, 0.55, 0);
    b.put(g, d.geo(new THREE.ConeGeometry(0.045, 0.1, 8)), mats.trim, 0, 1.3, 0).rotation.x = Math.PI;
    b.put(g, prism(d, [[-0.055, 0], [0.055, 0], [0.0, 0.36]], 0.03, 0.006), mats.energy, 0, 1.33, 0);
    b.put(g, rbox(d, 0.012, 0.3, 0.012, 0.004), mats.accent, 0, 0.9, 0.03);
    b.glow(g, 0.6, 0, 1.6, 0);
    const cloth = d.geo(new THREE.PlaneGeometry(0.26, 0.15, 10, 2));
    const flag = b.put(g, cloth, mats.glass, 0.13, 1.2, 0);
    flag.castShadow = false;
    const base = (cloth.getAttribute('position') as THREE.BufferAttribute).array.slice() as Float32Array;
    b.tick((t) => {
      const a = cloth.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) a.setZ(i, Math.sin(base[i * 3] * 18 - t * 5) * 0.025 * (base[i * 3] + 0.13) * 4);
      a.needsUpdate = true;
    });
  },
};

// ── AURA (around the whole character) ────────────────────────────────────────────────────────────────────────

const aura: Record<string, Fn> = {
  none: () => {},

  ring: (b) => {
    const { mats, d, s } = b;
    const g = b.at(b.c.turntable, 0, 1.1, 0);
    const mk = (R: number, tiltX: number, tiltZ: number) => {
      const grp = new THREE.Group();
      grp.rotation.set(tiltX, 0, tiltZ);
      const ring = b.put(grp, tor(d, R, 0.006, s), mats.accent);
      ring.rotation.x = Math.PI / 2;
      const dot = new THREE.Group();
      b.put(dot, sph(d, 0.022, 8), mats.energy);
      b.glow(dot, 0.2, 0, 0, 0);
      grp.add(dot);
      g.add(grp);
      return { grp, dot, R };
    };
    const A = mk(0.78, 0.25, 0.1);
    const B = mk(0.88, -0.4, -0.25);
    b.tick((t) => {
      A.dot.position.set(Math.cos(t * 1.3) * A.R, 0, Math.sin(t * 1.3) * A.R);
      B.dot.position.set(Math.cos(-t * 0.9 + 2) * B.R, 0, Math.sin(-t * 0.9 + 2) * B.R);
      A.grp.rotation.y = t * 0.2;
    });
  },

  embers: (b) => {
    const { mats, d } = b;
    const g = b.at(b.c.turntable, 0, 0, 0);
    const N = Math.round(b.c.kit.q.particles * 1.3);
    const pos = new Float32Array(N * 3);
    const spd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * TAU;
      const r = 0.35 + Math.random() * 0.55;
      pos.set([Math.cos(a) * r, Math.random() * 2.2, Math.sin(a) * r], i * 3);
      spd[i] = 0.18 + Math.random() * 0.35;
    }
    const geo = d.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = d.mat(new THREE.PointsMaterial({ size: 0.05, map: b.c.kit.tex.glow(), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    mats.followAccent(m);
    const pts = new THREE.Points(geo, m);
    pts.frustumCulled = false;
    g.add(pts);
    b.tick((t, dt) => {
      const a = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) {
        let y = a.getY(i) + spd[i] * dt;
        if (y > 2.3) y = 0;
        a.setY(i, y);
        a.setX(i, a.getX(i) + Math.sin(t * 2 + i) * 0.0009);
      }
      a.needsUpdate = true;
    });
  },

  nebula: (b) => {
    const { mats, d } = b;
    const g = b.at(b.c.turntable, 0, 1.1, 0);
    b.glow(g, 3.1, 0, 0, -0.55, 0.28);
    b.glow(g, 2.2, 0, 0.1, -0.35, 0.22);
    const N = Math.round(b.c.kit.q.particles * 2);
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU * 3;
      const r = 0.4 + (i / N) * 0.55;
      pos.set([Math.cos(a) * r, (Math.random() - 0.5) * 1.6, Math.sin(a) * r], i * 3);
    }
    const geo = d.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = d.mat(new THREE.PointsMaterial({ size: 0.05, map: b.c.kit.tex.glow(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    mats.followAccent(m);
    const swirl = new THREE.Points(geo, m);
    swirl.frustumCulled = false;
    g.add(swirl);
    const halo = b.put(g, tor(d, 0.95, 0.004, 48), mats.accent, 0, -1.08, 0);
    halo.rotation.x = Math.PI / 2;
    b.tick((t) => {
      swirl.rotation.y = t * 0.25;
      halo.scale.setScalar(1 + 0.04 * Math.sin(t * 1.5));
    });
  },
};

export const GEAR_B: Record<'back' | 'weapon' | 'aura', Record<string, Fn>> = { back, weapon, aura };
