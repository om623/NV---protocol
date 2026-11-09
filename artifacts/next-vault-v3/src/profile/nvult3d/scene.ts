import * as THREE from 'three';
import { PROFILES, downgrade, type QualityTier, type QualityProfile } from './support';
import { Textures, easeOutBack, smooth, type Kit } from './primitives';
import { Mats } from './materials';
import { FOV, frameFor } from './framing';
import { buildBody, type Rig } from './body';
import { buildStage, buildEnvScene, type StageFx } from './stage3d';
import { buildPart, buildTierFx, type PartInstance, type SlotId, type TierFx } from './parts';

export interface Look {
  head: string;
  armor: string;
  back: string;
  weapon: string;
  aura: string;
  style: 'sleek' | 'classic' | 'heavy';
  accent: string; // CSS hex
  finish: string; // real skin id
  tier: number; // evolution tier 0..6
}

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  tier: QualityTier;
  reducedMotion: boolean;
  autoQuality: boolean;
  onQuality?: (t: QualityTier) => void;
  onContext?: (lost: boolean) => void;
}

const SLOTS: SlotId[] = ['head', 'armor', 'back', 'weapon', 'aura'];


interface Content {
  tex: Textures;
  mats: Mats;
  kit: Kit;
  stage: StageFx;
  rig: Rig;
  fx: TierFx;
  parts: Map<SlotId, PartInstance>;
  env: THREE.WebGLRenderTarget;
}

interface Tween {
  obj: THREE.Object3D;
  to: THREE.Vector3;
  t: number;
  dur: number;
}

/** Owns the renderer, camera, content and loop for one canvas. Create one per visible 3D view and dispose it on unmount. */
export class NvultScene {
  private readonly canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 40);
  private readonly turntable = new THREE.Group();
  private c!: Content;
  private profile: QualityProfile;
  private look: Look | null = null;
  private reduced: boolean;
  private raf = 0;
  private running = false;
  private visible = true;
  private disposed = false;
  private lost = false;
  private last = 0;
  private time = 0;
  private frames = 0;
  private transitions = 0;
  private tweens: Tween[] = [];
  private yaw = 0;
  private yawVel = 0;
  private yawTarget: number | null = null;
  private dragging = false;
  private touched = 0; // seconds since the user last rotated by hand
  private px = 0;
  private py = 0;
  private decided = false;
  private winStart = 0;
  private winFrames = 0;
  private downgrades = 0;
  private io?: IntersectionObserver;
  private w = 1;
  private h = 1;

  constructor(private readonly o: SceneOptions) {
    this.canvas = o.canvas;
    this.reduced = o.reducedMotion;
    this.profile = PROFILES[o.tier];
    this.scene.add(this.turntable);
    this.createRenderer();
    this.buildContent();
    this.bind();
  }

  // ── setup ───────────────────────────────────────────────────────────────────────────────────────────────

  private createRenderer(): void {
    const p = this.profile;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: p.antialias, alpha: true, powerPreference: 'high-performance', premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.shadowMap.enabled = p.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.dprCap));
    this.renderer.setSize(this.w, this.h, false);
  }

  private buildContent(): void {
    const tex = new Textures();
    const mats = new Mats(tex);
    const kit: Kit = { mats, q: this.profile, tex };
    const stage = buildStage(kit);
    this.scene.add(stage.group);
    stage.lights.forEach((l) => this.scene.add(l));
    const rig = buildBody(kit);
    this.turntable.add(rig.root);
    const fx = buildTierFx(kit, rig, this.turntable);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = buildEnvScene();
    const env = pmrem.fromScene(envScene, 0.04);
    envScene.traverse((n) => {
      const m = n as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
    pmrem.dispose();
    this.scene.environment = env.texture;
    this.c = { tex, mats, kit, stage, rig, fx, parts: new Map(), env };
  }

  private destroyContent(): void {
    const c = this.c;
    if (!c) return;
    c.parts.forEach((p) => p.dispose());
    c.parts.clear();
    c.fx.dispose();
    c.rig.dispose();
    c.stage.dispose();
    c.stage.lights.forEach((l) => l.removeFromParent());
    this.scene.environment = null;
    c.env.dispose();
    c.mats.dispose();
    c.tex.dispose();
    this.tweens = [];
  }

  private onCtxLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.stop();
    this.o.onContext?.(true);
  };
  private onCtxRestored = () => {
    this.lost = false;
    this.destroyContent();
    this.buildContent();
    if (this.look) this.setLook(this.look, false);
    this.o.onContext?.(false);
    this.start();
  };
  private onVis = () => this.syncRunning();
  private onDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.dragging = true;
    this.px = e.clientX;
    this.py = e.clientY;
    this.yawVel = 0;
    this.canvas.setPointerCapture?.(e.pointerId);
  };
  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.px;
    this.px = e.clientX;
    this.py = e.clientY;
    this.yaw += dx * 0.011;
    this.yawVel = dx * 0.011;
    this.touched = 0;
    this.invalidate();
  };
  private onUp = (e: PointerEvent) => {
    this.dragging = false;
    this.canvas.releasePointerCapture?.(e.pointerId);
    this.publish();
  };

  private bind(): void {
    const cv = this.canvas;
    cv.addEventListener('webglcontextlost', this.onCtxLost);
    cv.addEventListener('webglcontextrestored', this.onCtxRestored);
    cv.addEventListener('pointerdown', this.onDown);
    cv.addEventListener('pointermove', this.onMove);
    cv.addEventListener('pointerup', this.onUp);
    cv.addEventListener('pointercancel', this.onUp);
    cv.style.touchAction = 'pan-y';
    document.addEventListener('visibilitychange', this.onVis);
    if ('IntersectionObserver' in window) {
      this.io = new IntersectionObserver((es) => {
        this.visible = es.some((x) => x.isIntersecting);
        this.syncRunning();
      });
      this.io.observe(cv);
    }
  }

  // ── public API ──────────────────────────────────────────────────────────────────────────────────────────

  setLook(look: Look, animate = true): void {
    const prev = this.look;
    const { mats, rig, fx } = this.c;
    const go = animate && !this.reduced;
    this.look = look;
    if (!prev || prev.finish !== look.finish) mats.setFinish(look.finish, !go);
    if (!prev || prev.accent !== look.accent) mats.setAccent(look.accent, !go);
    if (!prev || prev.style !== look.style) rig.setStyle(look.style);
    if (!prev || prev.tier !== look.tier) fx.setTier(look.tier);
    let changed = false;
    for (const slot of SLOTS) {
      if (prev && prev[slot] === look[slot]) continue;
      this.swapPart(slot, look[slot], go && !!prev);
      changed = changed || !!prev;
    }
    rig.setArmed(look.weapon !== 'none', !go);
    if (changed && go) {
      mats.flash(1);
      this.c.stage.pulse(1);
      this.transitions++;
    }
    this.publish(); // the exposed state always matches what was just asked for
    this.invalidate();
  }

  private swapPart(slot: SlotId, id: string, pop: boolean): void {
    const old = this.c.parts.get(slot);
    if (old) {
      old.dispose();
      this.c.parts.delete(slot);
    }
    const next = buildPart(slot, id, this.c.kit, this.c.rig, this.turntable);
    if (!next) return;
    this.c.parts.set(slot, next);
    if (pop) {
      for (const obj of next.objects) {
        const to = obj.scale.clone();
        obj.scale.multiplyScalar(0.01);
        this.tweens.push({ obj, to, t: 0, dur: 0.5 });
      }
    }
  }

  resize(w: number, h: number): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.profile.dprCap));
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    const f = frameFor(this.camera.aspect);
    this.camera.position.set(...f.position);
    this.camera.lookAt(...f.target);
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  rotateBy(rad: number): void {
    this.yaw += rad;
    this.touched = 0;
    this.publish();
    this.invalidate();
  }

  resetView(): void {
    const target = Math.round(this.yaw / (Math.PI * 2)) * Math.PI * 2;
    this.yawVel = 0;
    this.touched = 0;
    if (this.reduced) this.yaw = target;
    else this.yawTarget = target;
    this.invalidate();
  }

  setReducedMotion(b: boolean): void {
    this.reduced = b;
    this.syncRunning();
    this.invalidate();
  }

  setQuality(tier: QualityTier): void {
    if (tier === this.profile.tier) return;
    this.profile = PROFILES[tier];
    this.destroyContent();
    this.renderer.dispose();
    this.createRenderer();
    this.buildContent();
    this.resize(this.w, this.h);
    if (this.look) {
      const l = this.look;
      this.look = null;
      this.setLook(l, false);
    }
    this.o.onQuality?.(tier);
  }

  get tierNow(): QualityTier {
    return this.profile.tier;
  }

  snapshot(): string {
    this.renderFrame(0, true);
    return this.canvas.toDataURL('image/png');
  }

  // ── loop ────────────────────────────────────────────────────────────────────────────────────────────────

  start(): void {
    if (this.disposed || this.lost) return;
    this.running = true;
    this.syncRunning();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private syncRunning(): void {
    const should = this.running && this.visible && !document.hidden && !this.reduced && !this.lost && !this.disposed;
    if (should && !this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    } else if (!should && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.canvas.dataset.running = String(should);
  }

  private pending = false;
  /** Reduced motion has no loop: render once whenever something changed. */
  private invalidate(): void {
    if (this.disposed || this.lost || this.raf || this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      if (this.disposed || this.lost) return;
      this.renderFrame(1 / 30, false);
    });
  }

  private loop = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const minDt = 1 / this.profile.fpsCap;
    let dt = (now - this.last) / 1000;
    if (dt >= minDt - 0.002) {
      this.last = now;
      dt = Math.min(dt, 0.05);
      this.renderFrame(dt, false);
      this.guard(now, dt);
    }
    this.syncRunning();
    if (!this.raf && this.running && !this.reduced && this.visible && !document.hidden) this.raf = requestAnimationFrame(this.loop);
  };

  private renderFrame(dt: number, force: boolean): void {
    if (this.lost && !force) return;
    const still = this.reduced;
    this.time += still ? 0 : dt;
    const c = this.c;
    c.mats.tick(dt, !still);
    c.rig.update(this.time, dt, still);
    c.stage.tick(this.time, dt, still);
    c.fx.tick(this.time, dt, still);
    c.parts.forEach((p) => p.tick?.(this.time, dt, still));
    this.stepTweens(dt);
    // hand rotation with a little inertia, then a slow idle sway that fades out while the user is looking around
    if (this.dragging) this.yawTarget = null;
    if (this.yawTarget !== null) {
      this.yaw = smooth(this.yaw, this.yawTarget, 9, Math.max(dt, 1 / 60));
      if (Math.abs(this.yaw - this.yawTarget) < 0.002) {
        this.yaw = this.yawTarget;
        this.yawTarget = null;
      }
    } else if (!this.dragging) {
      this.yaw += this.yawVel;
      this.yawVel = smooth(this.yawVel, 0, 5, Math.max(dt, 1 / 60));
    }
    this.touched += dt;
    const sway = still ? 0 : 0.2 * Math.sin(this.time * 0.28) * Math.min(1, Math.max(0, (this.touched - 2.5) / 2));
    this.turntable.rotation.y = this.yaw + sway;
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    // static (reduced-motion) renders are rare, so publish every one: the state attributes must never lag behind the picture
    if (still || this.frames % 12 === 0 || force) this.publish();
  }

  private stepTweens(dt: number): void {
    for (const tw of this.tweens) {
      tw.t = Math.min(tw.dur, tw.t + dt);
      const k = tw.dur ? easeOutBack(tw.t / tw.dur) : 1;
      tw.obj.scale.copy(tw.to).multiplyScalar(0.01 + 0.99 * k);
    }
    this.tweens = this.tweens.filter((tw) => tw.t < tw.dur);
  }

  /** Guards frame rate: if the device cannot keep ~24fps in auto mode, step down one tier (at most twice). */
  private guard(now: number, dt: number): void {
    if (!this.o.autoQuality || this.decided) return;
    if (!this.winStart) {
      this.winStart = now;
      this.winFrames = 0;
    }
    this.winFrames++;
    const span = (now - this.winStart) / 1000;
    if (this.winFrames >= 90 || span > 4) {
      const fps = this.winFrames / Math.max(span, 0.001);
      this.winStart = 0;
      const next = downgrade(this.profile.tier);
      if (fps < 24 && next && this.downgrades < 2) {
        this.downgrades++;
        this.setQuality(next);
      } else {
        this.decided = true;
      }
    }
    void dt;
  }

  private publish(): void {
    const ds = this.canvas.dataset;
    const info = this.renderer.info.render;
    ds.frames = String(this.frames);
    ds.yaw = (((((this.yaw * 180) / Math.PI) % 360) + 360) % 360).toFixed(1); // the rotation the user chose (without the idle sway)
    ds.tier = this.profile.tier;
    if (this.frames > 0) {
      // before the first real frame renderer.info still describes the internal reflection pass (a 12-triangle cube)
      ds.tris = String(info.triangles);
      ds.calls = String(info.calls);
    }
    ds.finish = this.look?.finish ?? '';
    ds.accent = this.look?.accent ?? '';
    ds.look = this.look ? `${this.look.head}|${this.look.armor}|${this.look.back}|${this.look.weapon}|${this.look.aura}|${this.look.style}` : '';
    ds.parts = String(this.c.parts.size);
    ds.transitions = String(this.transitions);
    ds.tweens = String(this.tweens.length);
    ds.reduced = String(this.reduced);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    const cv = this.canvas;
    cv.removeEventListener('webglcontextlost', this.onCtxLost);
    cv.removeEventListener('webglcontextrestored', this.onCtxRestored);
    cv.removeEventListener('pointerdown', this.onDown);
    cv.removeEventListener('pointermove', this.onMove);
    cv.removeEventListener('pointerup', this.onUp);
    cv.removeEventListener('pointercancel', this.onUp);
    document.removeEventListener('visibilitychange', this.onVis);
    this.io?.disconnect();
    this.destroyContent();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    delete cv.dataset.running;
  }
}
