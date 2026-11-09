import * as THREE from 'three';
import { Disposer, type Kit, rbox, prism, tube, cyl, sph, tor, mesh, glowSprite, disposeObject, TAU } from './primitives';
import type { Rig } from './body';
import type { PartInstance } from './parts';

export interface Ctx {
  kit: Kit;
  rig: Rig;
  turntable: THREE.Object3D;
}

/** Builds a part out of groups attached to rig anchors. Removing the part detaches and frees everything it created. */
export class PartBuilder {
  readonly d = new Disposer();
  private readonly links: Array<[THREE.Object3D, THREE.Object3D]> = [];
  ticks: Array<(t: number, dt: number) => void> = [];
  constructor(readonly c: Ctx) {}
  get mats() {
    return this.c.kit.mats;
  }
  get s() {
    return this.c.kit.q.segments;
  }
  /** A group at the anchor's origin. Everything of this part lives inside such groups, so the pop-in scales about the anchor. */
  at(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    this.links.push([parent, g]);
    return g;
  }
  put(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const m = mesh(geo, mat, x, y, z);
    parent.add(m);
    return m;
  }
  glow(parent: THREE.Object3D, size: number, x: number, y: number, z: number, opacity = 0.8): void {
    const g = glowSprite(this.c.kit, size, opacity);
    g.position.set(x, y, z);
    parent.add(g);
  }
  tick(fn: (t: number, dt: number) => void): void {
    this.ticks.push(fn);
  }
  done(): PartInstance {
    const links = this.links;
    const ticks = this.ticks;
    const kit = this.c.kit;
    return {
      objects: links.map(([, g]) => g),
      tick: ticks.length ? (t, dt) => ticks.forEach((f) => f(t, dt)) : undefined,
      dispose: () => {
        links.forEach(([, g]) => {
          disposeObject(g, kit);
          g.removeFromParent();
        });
        this.d.dispose();
      },
    };
  }
}

type Fn = (b: PartBuilder) => void;

// ── HEAD ─────────────────────────────────────────────────────────────────────────────────────────────────────

const head: Record<string, Fn> = {
  standard: () => {},

  crest: (b) => {
    const { mats, d, s } = b;
    const g = b.at(b.c.rig.headTop);
    b.put(g, rbox(d, 0.1, 0.03, 0.08, 0.01), mats.trim, 0, 0.005, 0);
    const crystal = b.put(g, d.geo(new THREE.OctahedronGeometry(0.05, 0)), mats.accent, 0, 0.1, 0);
    crystal.scale.set(0.8, 2.3, 0.8);
    for (const sx of [-1, 1]) {
      const sh = b.put(g, d.geo(new THREE.OctahedronGeometry(0.026, 0)), mats.accent, sx * 0.06, 0.05, 0);
      sh.scale.set(0.7, 1.9, 0.7);
      sh.rotation.z = -sx * 0.42;
    }
    b.glow(g, 0.34, 0, 0.1, 0);
    b.tick((t) => {
      const k = 1 + 0.06 * Math.sin(t * 2.2);
      crystal.scale.set(0.8 * k, 2.3 * k, 0.8 * k);
    });
    void s;
  },

  dome: (b) => {
    const { mats, d, s } = b;
    const g = b.at(b.c.rig.head);
    const cap = b.put(g, d.geo(new THREE.SphereGeometry(0.15, s, Math.max(6, s >> 1), 0, TAU, 0, Math.PI / 2)), mats.armor, 0, 0.1, 0);
    cap.scale.set(1, 0.8, 1.15);
    b.put(g, rbox(d, 0.022, 0.012, 0.27, 0.005), mats.trim, 0, 0.222, 0);
    const gem = b.put(g, d.geo(new THREE.OctahedronGeometry(0.022, 0)), mats.accent, 0, 0.17, 0.12);
    gem.scale.set(0.8, 1.3, 0.6);
    b.glow(g, 0.2, 0, 0.17, 0.14);
    for (const sx of [-1, 1]) b.put(g, rbox(d, 0.012, 0.07, 0.1, 0.004), mats.dark, sx * 0.147, 0.1, -0.03);
    void s;
  },

  spectra: (b) => {
    const { mats, d } = b;
    const g = b.at(b.c.rig.head);
    b.put(g, prism(d, [[-0.165, 0.075], [0.165, 0.075], [0.155, -0.03], [0.12, -0.075], [-0.12, -0.075], [-0.155, -0.03]], 0.04, 0.01), mats.glass, 0, 0.035, 0.14);
    b.put(g, rbox(d, 0.34, 0.012, 0.012, 0.004), mats.energy, 0, 0.082, 0.165);
    b.put(g, d.geo(new THREE.ConeGeometry(0.02, 0.17, 4)), mats.accent, 0, 0.255, 0);
    for (const sx of [-1, 1]) {
      b.put(g, rbox(d, 0.02, 0.05, 0.06, 0.006), mats.accent, sx * 0.158, 0.02, 0.06);
      b.glow(g, 0.14, sx * 0.165, 0.02, 0.08);
    }
    const scan = b.put(g, rbox(d, 0.02, 0.1, 0.01, 0.003), mats.energy, 0, 0.035, 0.168);
    b.tick((t) => (scan.position.x = 0.14 * Math.sin(t * 1.7)));
  },

  halo: (b) => {
    const { mats, d, s } = b;
    const g = b.at(b.c.rig.headTop, 0, 0.1, 0);
    const ring = new THREE.Group();
    ring.rotation.x = 0.12;
    g.add(ring);
    b.put(ring, tor(d, 0.21, 0.011, s), mats.accent).rotation.x = Math.PI / 2;
    b.put(ring, tor(d, 0.16, 0.005, s), mats.energy).rotation.x = Math.PI / 2;
    const nodes: THREE.Object3D[] = [];
    for (let i = 0; i < 3; i++) {
      const n = new THREE.Group();
      b.put(n, sph(d, 0.016, 8), mats.accent);
      b.glow(n, 0.12, 0, 0, 0);
      ring.add(n);
      nodes.push(n);
    }
    b.glow(g, 0.7, 0, 0, 0, 0.18);
    b.tick((t) => {
      nodes.forEach((n, i) => n.position.set(Math.cos(t * 0.9 + (i * TAU) / 3) * 0.21, 0, Math.sin(t * 0.9 + (i * TAU) / 3) * 0.21));
      g.position.y = 0.1 + 0.012 * Math.sin(t * 1.4);
    });
  },

  aegis: (b) => {
    const { mats, d } = b;
    const g = b.at(b.c.rig.headTop);
    const blade = (h: number, r: number, x: number, y: number, rot: number, m: THREE.Material) => {
      const c = b.put(g, d.geo(new THREE.ConeGeometry(r, h, 4)), m, x, y, 0);
      c.rotation.z = rot;
      c.rotation.y = Math.PI / 4;
    };
    blade(0.3, 0.034, 0, 0.14, 0, mats.armor);
    blade(0.2, 0.026, -0.09, 0.07, 0.5, mats.armor);
    blade(0.2, 0.026, 0.09, 0.07, -0.5, mats.armor);
    blade(0.13, 0.02, -0.14, 0.01, 0.95, mats.trim);
    blade(0.13, 0.02, 0.14, 0.01, -0.95, mats.trim);
    const gem = b.put(g, d.geo(new THREE.OctahedronGeometry(0.024, 0)), mats.accent, 0, 0.06, 0.05);
    gem.scale.set(0.8, 1.4, 0.8);
    b.glow(g, 0.3, 0, 0.1, 0.06);
  },
};

// ── ARMOR ────────────────────────────────────────────────────────────────────────────────────────────────────

const armor: Record<string, Fn> = {
  core: () => {},

  plated: (b) => {
    const { mats, d, c, s } = b;
    const ch = b.at(c.rig.chest);
    b.put(ch, rbox(d, 0.32, 0.11, 0.05, 0.02), mats.armor, 0, -0.1, 0.16);
    b.put(ch, rbox(d, 0.2, 0.025, 0.03, 0.008), mats.accent, 0, -0.18, 0.18);
    const pv = b.at(c.rig.pelvis);
    b.put(pv, rbox(d, 0.3, 0.07, 0.09, 0.02), mats.armor, 0, 0.1, 0.135);
    for (const sx of [-1, 1]) {
      const cap = b.at(sx < 0 ? c.rig.capL : c.rig.capR);
      const sh = b.put(cap, d.geo(new THREE.SphereGeometry(0.135, s, Math.max(6, s >> 1), 0, TAU, 0, Math.PI / 2)), mats.armor, 0, 0.0, 0);
      sh.scale.set(1, 0.7, 1.15);
      sh.rotation.z = -sx * 0.3;
      for (let i = 0; i < 3; i++) b.put(cap, sph(d, 0.009, 6), mats.accent, sx * 0.1, 0.045, (i - 1) * 0.05);
    }
  },

  pulse: (b) => {
    const { mats, d, c } = b;
    for (const sx of [-1, 1]) {
      const cap = b.at(sx < 0 ? c.rig.capL : c.rig.capR);
      const p = b.put(cap, prism(d, [[-0.085, -0.02], [0.085, -0.02], [0.065, 0.12], [-0.065, 0.12]], 0.035, 0.01), mats.glass, sx * 0.045, 0.045, 0.085);
      p.rotation.z = -sx * 0.5;
      p.rotation.x = -0.35;
      b.glow(cap, 0.3, sx * 0.05, 0.1, 0.1, 0.5);
      const ch = b.at(c.rig.chest);
      b.put(ch, prism(d, [[-0.03, -0.1], [0.03, -0.1], [0.045, 0.1], [-0.045, 0.1]], 0.03, 0.008), mats.glass, sx * 0.235, 0.06, 0.1);
    }
    const pv = b.at(c.rig.pelvis);
    b.put(pv, rbox(d, 0.3, 0.014, 0.02, 0.005), mats.energy, 0, 0.05, 0.145);
    const chest = b.at(c.rig.chest);
    b.put(chest, tube(d, [new THREE.Vector3(-0.2, 0.2, 0.16), new THREE.Vector3(-0.1, 0.12, 0.18), new THREE.Vector3(0, 0.12, 0.185)], 0.007, 12, 4), mats.conduit);
    b.put(chest, tube(d, [new THREE.Vector3(0.2, 0.2, 0.16), new THREE.Vector3(0.1, 0.12, 0.18), new THREE.Vector3(0, 0.12, 0.185)], 0.007, 12, 4), mats.conduit);
  },

  bulwark: (b) => {
    const { mats, d, c, s } = b;
    for (const sx of [-1, 1]) {
      const cap = b.at(sx < 0 ? c.rig.capL : c.rig.capR);
      [0.155, 0.14, 0.125].forEach((r, i) => {
        const sh = b.put(cap, d.geo(new THREE.SphereGeometry(r, s, Math.max(6, s >> 1), 0, TAU, 0, Math.PI / 2)), i % 2 ? mats.trim : mats.armor, sx * 0.01, -i * 0.05, 0);
        sh.scale.set(1, 0.55, 1.2);
        sh.rotation.z = -sx * (0.3 + i * 0.06);
      });
      const fa = b.at(sx < 0 ? c.rig.forearmL : c.rig.forearmR);
      b.put(fa, rbox(d, 0.125, 0.2, 0.125, 0.03), mats.armor, 0, -0.14, 0.0);
      b.put(fa, rbox(d, 0.02, 0.15, 0.02, 0.006), mats.accent, 0, -0.14, 0.068);
    }
    const ch = b.at(c.rig.chest);
    b.put(ch, prism(d, [[-0.2, 0.12], [0.2, 0.12], [0.17, -0.1], [0, -0.22], [-0.17, -0.1]], 0.05, 0.02), mats.armor, 0, 0.0, 0.17);
    b.put(ch, rbox(d, 0.016, 0.3, 0.02, 0.005), mats.accent, 0, -0.04, 0.2);
    b.put(ch, cyl(d, 0.13, 0.17, 0.07, s), mats.armor, 0, 0.3, 0);
  },

  vanguard: (b) => {
    const { mats, d, c, s } = b;
    for (const sx of [-1, 1]) {
      const cap = b.at(sx < 0 ? c.rig.capL : c.rig.capR);
      const sh = b.put(cap, d.geo(new THREE.SphereGeometry(0.14, s, Math.max(6, s >> 1), 0, TAU, 0, Math.PI / 2)), mats.armor, 0, 0, 0);
      sh.scale.set(1, 0.7, 1.15);
      sh.rotation.z = -sx * 0.3;
      const spike = b.put(cap, d.geo(new THREE.ConeGeometry(0.04, 0.24, 6)), mats.trim, sx * 0.07, 0.15, 0);
      spike.rotation.z = -sx * 0.55;
      b.put(cap, tor(d, 0.13, 0.007, s), mats.accent, 0, -0.01, 0).rotation.x = Math.PI / 2;
      const pv = b.at(c.rig.pelvis);
      b.put(pv, prism(d, [[-0.065, 0], [0.065, 0], [0.05, -0.24], [-0.05, -0.24]], 0.03, 0.01), mats.armor, sx * 0.2, -0.05, 0.05);
      b.put(pv, prism(d, [[-0.06, 0], [0.06, 0], [0.04, -0.26], [-0.04, -0.26]], 0.03, 0.01), mats.armor, sx * 0.085, -0.08, 0.155);
    }
    const ne = b.at(c.rig.neck);
    b.put(ne, tor(d, 0.15, 0.022, s), mats.armor, 0, -0.02, 0).rotation.x = Math.PI / 2;
    const ch = b.at(c.rig.chest);
    b.put(ch, prism(d, [[-0.055, -0.045], [0.055, -0.045], [0, 0.075]], 0.025, 0.006), mats.accent, 0, 0.12, 0.17);
    b.glow(ch, 0.26, 0, 0.12, 0.2);
  },
};

export const GEAR: Record<'head' | 'armor', Record<string, Fn>> = { head, armor };
