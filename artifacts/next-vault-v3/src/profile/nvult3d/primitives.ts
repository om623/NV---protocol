import * as THREE from 'three';
import type { Mats } from './materials';
import type { QualityProfile } from './support';

/** Tracks everything a part allocates so removing the part frees GPU memory. Shared kit resources are never tracked here. */
export class Disposer {
  private geos = new Set<THREE.BufferGeometry>();
  private mats = new Set<THREE.Material>();
  geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.add(g);
    return g;
  }
  mat<T extends THREE.Material>(m: T): T {
    this.mats.add(m);
    return m;
  }
  dispose(): void {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.geos.clear();
    this.mats.clear();
  }
  get size(): number {
    return this.geos.size + this.mats.size;
  }
}

/** Procedural textures, created lazily and shared. Falls back to a 1x1 texture where there is no DOM (unit tests). */
export class Textures {
  private cache = new Map<string, THREE.Texture>();

  private make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, wrap = false): THREE.Texture {
    const hit = this.cache.get(key);
    if (hit) return hit;
    let t: THREE.Texture;
    if (typeof document === 'undefined') {
      t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      t.needsUpdate = true;
    } else {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      if (g) draw(g);
      t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
    }
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    this.cache.set(key, t);
    return t;
  }

  glow(): THREE.Texture {
    return this.make('glow', 64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.25, 'rgba(255,255,255,.55)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 64, 64);
    });
  }

  /** Dashes used by the energy conduits; scrolling its offset makes the energy "flow". */
  dash(): THREE.Texture {
    return this.make(
      'dash',
      128,
      8,
      (g) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, 128, 8);
        const lg = g.createLinearGradient(0, 0, 128, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(0.5, 'rgba(255,255,255,1)');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg;
        g.fillRect(0, 0, 64, 8);
        g.fillStyle = 'rgba(255,255,255,.18)';
        g.fillRect(64, 0, 64, 8);
      },
      true,
    );
  }

  grid(): THREE.Texture {
    return this.make(
      'grid',
      256,
      256,
      (g) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, 256, 256);
        g.strokeStyle = 'rgba(255,255,255,.9)';
        g.lineWidth = 2;
        for (let i = 0; i <= 8; i++) {
          g.beginPath();
          g.moveTo(i * 32, 0);
          g.lineTo(i * 32, 256);
          g.moveTo(0, i * 32);
          g.lineTo(256, i * 32);
          g.stroke();
        }
        g.strokeStyle = 'rgba(255,255,255,.5)';
        g.beginPath();
        g.arc(128, 128, 96, 0, Math.PI * 2);
        g.arc(128, 128, 48, 0, Math.PI * 2);
        g.stroke();
      },
      true,
    );
  }

  /** Vertical fade for the projector light cone (opaque at the base, transparent at the top). */
  coneFade(): THREE.Texture {
    return this.make('cone', 4, 128, (g) => {
      const lg = g.createLinearGradient(0, 0, 0, 128);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = lg;
      g.fillRect(0, 0, 4, 128);
    });
  }

  dispose(): void {
    this.cache.forEach((t) => t.dispose());
    this.cache.clear();
  }
}

/** Everything a part builder needs. `d` is per-part; the rest is shared by the scene. */
export interface Kit {
  mats: Mats;
  q: QualityProfile;
  tex: Textures;
}

// ── geometry helpers ─────────────────────────────────────────────────────────────────────────────────────────

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.max(0.0005, Math.min(r, w / 2 - 0.0005, h / 2 - 0.0005));
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

/** Box with softened, bevelled edges (the armour-plate look). Centred on the origin. */
export function rbox(d: Disposer, w: number, h: number, dp: number, r = 0.014): THREE.ExtrudeGeometry {
  const b = Math.min(r, w / 3, h / 3, dp / 3);
  const g = new THREE.ExtrudeGeometry(roundedRect(Math.max(0.002, w - 2 * b), Math.max(0.002, h - 2 * b), Math.max(0.0005, r - b)), {
    depth: Math.max(0.002, dp - 2 * b),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 3,
  });
  g.translate(0, 0, -(dp - 2 * b) / 2);
  g.computeVertexNormals();
  return d.geo(g);
}

/** A bevelled polygon extruded along Z and centred on it. Points are in the XY plane. */
export function prism(d: Disposer, pts: ReadonlyArray<readonly [number, number]>, depth: number, bevel = 0.012): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const b = Math.min(bevel, depth / 3);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, depth - 2 * b),
    bevelEnabled: b > 0.0005,
    bevelThickness: b,
    bevelSize: b * 0.8,
    bevelSegments: 2,
    curveSegments: 2,
  });
  g.translate(0, 0, -(depth - 2 * b) / 2);
  g.computeVertexNormals();
  return d.geo(g);
}

export function tube(d: Disposer, pts: THREE.Vector3[], radius: number, tubular = 20, radial = 5): THREE.TubeGeometry {
  return d.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), tubular, radius, radial, false));
}

export const cyl = (d: Disposer, rt: number, rb: number, h: number, seg: number) => d.geo(new THREE.CylinderGeometry(rt, rb, h, seg, 1));
export const sph = (d: Disposer, r: number, seg: number) => d.geo(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))));
export const tor = (d: Disposer, R: number, r: number, seg: number) => d.geo(new THREE.TorusGeometry(R, r, 8, Math.max(16, seg * 2)));

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Additive glow billboard. On the low tier it is skipped (an empty object keeps call sites simple). */
export function glowSprite(kit: Kit, size: number, opacity = 0.85, white = false): THREE.Object3D {
  if (!kit.q.glow) return new THREE.Object3D();
  const m = new THREE.SpriteMaterial({
    map: kit.tex.glow(),
    color: white ? 0xffffff : 0xffffff,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  if (!white) kit.mats.followAccent(m);
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  s.userData.ownMaterial = m;
  return s;
}

/** Frees the materials of glow sprites, which are owned by the sprite rather than the shared kit. */
export function disposeObject(o: THREE.Object3D, kit?: Kit): void {
  o.traverse((n) => {
    const s = n as THREE.Sprite;
    if (s.userData?.ownMaterial) {
      kit?.mats.unfollow(s.userData.ownMaterial as THREE.SpriteMaterial);
      (s.userData.ownMaterial as THREE.Material).dispose();
    }
  });
}

export const TAU = Math.PI * 2;
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const smooth = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));
