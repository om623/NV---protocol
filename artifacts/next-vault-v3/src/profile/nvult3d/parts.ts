import * as THREE from 'three';
import { Disposer, type Kit, sph, tor, mesh, glowSprite, disposeObject, TAU } from './primitives';
import type { Rig } from './body';
import { PartBuilder, GEAR } from './partsGear';
import { GEAR_B } from './partsGearB';

export type SlotId = 'head' | 'armor' | 'back' | 'weapon' | 'aura';

export interface PartInstance {
  objects: THREE.Object3D[]; // roots that get the "materialise" pop-in
  tick?(t: number, dt: number, still: boolean): void;
  dispose(): void;
}

export interface TierFx {
  setTier(n: number): void;
  tick(t: number, dt: number, still: boolean): void;
  dispose(): void;
}

/** Builds one equipment part for a slot. Returns null for the "nothing" options (standard head, core armour, no weapon...). */
export function buildPart(slot: SlotId, id: string, kit: Kit, rig: Rig, turntable: THREE.Object3D): PartInstance | null {
  const table = slot === 'head' || slot === 'armor' ? GEAR[slot] : GEAR_B[slot];
  const fn = table[id];
  if (!fn) return null;
  const b = new PartBuilder({ kit, rig, turntable });
  fn(b);
  const inst = b.done();
  if (!inst.objects.length) {
    inst.dispose();
    return null;
  }
  return inst;
}

/** Visual evolution tied to the real level tier (0..6): more light, orbiting shards, a crown at the top. */
export function buildTierFx(kit: Kit, rig: Rig, turntable: THREE.Object3D): TierFx {
  const { mats, q } = kit;
  const d = new Disposer();
  const world = new THREE.Group();
  world.position.y = 1.1;
  turntable.add(world);
  let attached: Array<[THREE.Object3D, THREE.Object3D]> = [];
  let spin: THREE.Object3D | null = null;
  let shards: THREE.Object3D[] = [];
  let crown: THREE.Object3D | null = null;

  const attach = (parent: THREE.Object3D, child: THREE.Object3D) => {
    parent.add(child);
    attached.push([parent, child]);
  };

  function clear() {
    attached.forEach(([, c]) => {
      disposeObject(c, kit);
      c.removeFromParent();
    });
    attached = [];
    shards.forEach((s) => s.removeFromParent());
    shards = [];
    spin = null;
    crown = null;
  }

  return {
    setTier(n) {
      clear();
      if (n >= 1) {
        for (const sx of [-1, 1]) {
          const light = new THREE.Group();
          light.position.set(sx * 0.08, 0.1, 0.07);
          light.add(mesh(sph(d, 0.016, 8), mats.accent));
          const g = glowSprite(kit, 0.2, 0.8);
          light.add(g);
          attach(sx < 0 ? rig.capL : rig.capR, light);
        }
      }
      if (n >= 2) {
        const ring = mesh(tor(d, 0.1, 0.007, q.segments), mats.accent, 0, 0.04, 0.172);
        ring.castShadow = false;
        attach(rig.chest, ring);
        spin = ring;
      }
      if (n >= 3) {
        const count = Math.min(4, n - 2);
        for (let i = 0; i < count; i++) {
          const sh = new THREE.Group();
          const m = mesh(d.geo(new THREE.OctahedronGeometry(0.05, 0)), i % 2 ? mats.armor : mats.accent);
          m.scale.set(0.6, 1.4, 0.6);
          sh.add(m);
          sh.add(glowSprite(kit, 0.2, 0.5));
          sh.userData.phase = (i / count) * TAU;
          sh.userData.h = 0.35 + (i % 3) * 0.28;
          attach(world, sh);
          shards.push(sh);
        }
      }
      if (n >= 4) {
        const r = mesh(tor(d, 0.26, 0.004, 40), mats.energy, 0, 0.02, -0.16);
        r.castShadow = false;
        attach(rig.head, r);
      }
      if (n >= 6) {
        const c = new THREE.Group();
        c.position.y = 0.38;
        const r = mesh(tor(d, 0.12, 0.006, q.segments), mats.energy);
        r.rotation.x = Math.PI / 2;
        r.castShadow = false;
        c.add(r);
        c.add(glowSprite(kit, 0.5, 0.7));
        attach(rig.headTop, c);
        crown = c;
      }
    },
    tick(t, _dt, still) {
      if (still) return;
      if (spin) spin.rotation.z = t * 0.9;
      shards.forEach((s, i) => {
        const a = t * (0.5 + i * 0.07) + (s.userData.phase as number);
        s.position.set(Math.cos(a) * 0.88, (s.userData.h as number) - 0.5 + 0.05 * Math.sin(t * 1.4 + i), Math.sin(a) * 0.88);
        s.rotation.y = t + i;
      });
      if (crown) crown.rotation.y = t * 0.6;
    },
    dispose() {
      clear();
      d.dispose();
      world.removeFromParent();
    },
  };
}
