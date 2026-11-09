import * as THREE from 'three';
import type { Textures } from './primitives';

export interface FinishDef {
  color: number;
  metalness: number;
  roughness: number;
  clearcoat: number;
  iridescence: number;
  emissive: number;
  emissiveIntensity: number;
}

/** One physically based finish per real skin id. Keys match `SKINS` in lib/gamification (default + 6 skins). */
export const FINISH3D: Record<string, FinishDef> = {
  default: { color: 0x8f9db0, metalness: 0.92, roughness: 0.34, clearcoat: 0.35, iridescence: 0, emissive: 0x000000, emissiveIntensity: 0 },
  bronze: { color: 0xb87333, metalness: 0.95, roughness: 0.3, clearcoat: 0.4, iridescence: 0, emissive: 0x000000, emissiveIntensity: 0 },
  silver: { color: 0xd3dae3, metalness: 1, roughness: 0.18, clearcoat: 0.5, iridescence: 0, emissive: 0x000000, emissiveIntensity: 0 },
  gold: { color: 0xe6b73a, metalness: 1, roughness: 0.2, clearcoat: 0.5, iridescence: 0, emissive: 0x000000, emissiveIntensity: 0 },
  platinum: { color: 0xc9e6ef, metalness: 1, roughness: 0.12, clearcoat: 1, iridescence: 0.6, emissive: 0x000000, emissiveIntensity: 0 },
  'premium-500': { color: 0xf2b134, metalness: 1, roughness: 0.16, clearcoat: 0.8, iridescence: 0.2, emissive: 0x3a2204, emissiveIntensity: 0.6 },
  'premium-1000': { color: 0xffcf5a, metalness: 1, roughness: 0.1, clearcoat: 1, iridescence: 0.8, emissive: 0x4a2c06, emissiveIntensity: 0.9 },
};

export const finish3d = (id: string): FinishDef => FINISH3D[id] ?? FINISH3D.default;

const WHITE = new THREE.Color(1, 1, 1);
const cdist = (a: THREE.Color, b: THREE.Color) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

/** All materials shared by the character. They are shared on purpose: changing a skin or the accent recolours everything at once. */
export class Mats {
  readonly armor: THREE.MeshPhysicalMaterial;
  readonly trim: THREE.MeshStandardMaterial; // gunmetal secondary plates
  readonly dark: THREE.MeshStandardMaterial; // carbon under-layer
  readonly accent: THREE.MeshStandardMaterial; // emissive panels
  readonly glass: THREE.MeshPhysicalMaterial; // translucent accent shells
  readonly visor: THREE.MeshPhysicalMaterial;
  readonly eye: THREE.MeshBasicMaterial;
  readonly energy: THREE.MeshBasicMaterial; // blade cores, bright lines
  readonly conduit: THREE.MeshBasicMaterial; // flowing energy lines
  readonly floor: THREE.MeshBasicMaterial; // pedestal glow lines

  private readonly accentCur = new THREE.Color('#2dd4bf');
  private readonly accentTgt = new THREE.Color('#2dd4bf');
  private readonly lightAccent = new THREE.Color();
  private readonly finCur = new THREE.Color();
  private readonly finTgt = new THREE.Color();
  private fin: FinishDef = FINISH3D.default;
  private cur = { metal: 0.92, rough: 0.34, clear: 0.35, irid: 0, emiI: 0 };
  private followers = new Set<{ color: THREE.Color }>();
  private flashAmt = 0;
  private dashTex: THREE.Texture;
  private time = 0;

  constructor(tex: Textures) {
    this.armor = new THREE.MeshPhysicalMaterial({ color: FINISH3D.default.color, metalness: 0.92, roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.25, envMapIntensity: 1.25 });
    this.trim = new THREE.MeshStandardMaterial({ color: 0x2b3442, metalness: 0.85, roughness: 0.42, envMapIntensity: 1 });
    this.dark = new THREE.MeshStandardMaterial({ color: 0x0a0f18, metalness: 0.55, roughness: 0.55, envMapIntensity: 0.7 });
    this.accent = new THREE.MeshStandardMaterial({ color: 0x050709, emissive: 0x2dd4bf, emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.4, toneMapped: false });
    this.glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1018, emissive: 0x2dd4bf, emissiveIntensity: 0.9, metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 1.6, side: THREE.DoubleSide });
    this.visor = new THREE.MeshPhysicalMaterial({ color: 0x03060b, metalness: 0.9, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2 });
    this.eye = new THREE.MeshBasicMaterial({ color: 0x9ff8ea, toneMapped: false });
    this.energy = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.dashTex = tex.dash();
    this.dashTex.repeat.set(4, 1);
    this.conduit = new THREE.MeshBasicMaterial({ color: 0x2dd4bf, map: this.dashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.floor = new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.9, toneMapped: false });
    this.setFinish('default', true);
    this.setAccent('#2dd4bf', true);
  }

  /** Objects (sprite/basic materials) whose `color` should track the accent colour. */
  followAccent(m: { color: THREE.Color }): void {
    this.followers.add(m);
    m.color.copy(this.accentCur);
  }
  unfollow(m: { color: THREE.Color }): void {
    this.followers.delete(m);
  }

  get accentColor(): THREE.Color {
    return this.accentCur;
  }

  setFinish(id: string, instant = false): void {
    this.fin = finish3d(id);
    this.finTgt.setHex(this.fin.color);
    if (instant) {
      this.finCur.copy(this.finTgt);
      this.cur = { metal: this.fin.metalness, rough: this.fin.roughness, clear: this.fin.clearcoat, irid: this.fin.iridescence, emiI: this.fin.emissiveIntensity };
      this.applyFinish();
    }
  }

  setAccent(hex: string, instant = false): void {
    this.accentTgt.set(hex);
    if (instant) {
      this.accentCur.copy(this.accentTgt);
      this.applyAccent();
    }
  }

  /** Brief emissive surge, used when a part is equipped. */
  flash(amount = 1): void {
    this.flashAmt = Math.max(this.flashAmt, amount);
  }

  /** Advances colour/finish transitions, the energy flow and the flash. Returns true while something is still changing. */
  tick(dt: number, animate: boolean): boolean {
    this.time += dt;
    let moving = false;
    const k = animate ? 1 - Math.exp(-dt * 7) : 1;
    if (cdist(this.accentCur, this.accentTgt) > 0.002) {
      this.accentCur.lerp(this.accentTgt, k);
      moving = true;
    }
    const f = this.fin;
    const c = this.cur;
    if (cdist(this.finCur, this.finTgt) > 0.002 || Math.abs(c.rough - f.roughness) > 0.002 || Math.abs(c.irid - f.iridescence) > 0.01) {
      this.finCur.lerp(this.finTgt, k);
      c.metal += (f.metalness - c.metal) * k;
      c.rough += (f.roughness - c.rough) * k;
      c.clear += (f.clearcoat - c.clear) * k;
      c.irid += (f.iridescence - c.irid) * k;
      c.emiI += (f.emissiveIntensity - c.emiI) * k;
      this.applyFinish();
      moving = true;
    }
    if (this.flashAmt > 0.001) {
      this.flashAmt = animate ? Math.max(0, this.flashAmt - dt * 2.1) : 0;
      moving = true;
    }
    this.applyAccent();
    if (animate) this.dashTex.offset.x = -(this.time * 0.55) % 1;
    return moving;
  }

  private applyFinish(): void {
    const a = this.armor;
    a.color.copy(this.finCur);
    a.metalness = this.cur.metal;
    a.roughness = this.cur.rough;
    a.clearcoat = this.cur.clear;
    a.iridescence = this.cur.irid;
    a.emissive.setHex(this.fin.emissive);
    a.emissiveIntensity = this.cur.emiI;
  }

  private applyAccent(): void {
    const a = this.accentCur;
    this.lightAccent.copy(a).lerp(WHITE, 0.55);
    const boost = this.flashAmt * 3.2;
    this.accent.emissive.copy(a);
    this.accent.emissiveIntensity = 2.2 + boost;
    this.glass.emissive.copy(a);
    this.glass.emissiveIntensity = 0.9 + boost * 0.4;
    this.eye.color.copy(this.lightAccent);
    this.energy.color.copy(this.lightAccent);
    this.conduit.color.copy(a);
    this.floor.color.copy(a);
    this.followers.forEach((f) => f.color.copy(a));
  }

  dispose(): void {
    [this.armor, this.trim, this.dark, this.accent, this.glass, this.visor, this.eye, this.energy, this.conduit, this.floor].forEach((m) => m.dispose());
    this.followers.clear();
  }
}
