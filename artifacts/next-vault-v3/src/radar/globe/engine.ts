import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clusterPoints, fromXYZ, toXYZ, type Cluster, type MarkerPoint, type WorldGeo } from '../geo';
import { buildBaseTexture, createAtmosphere, createHighlightLayer, createNetwork, createStars, makeGlowTexture } from './layers';
import { Overlay, type LabelSpec } from './overlay';

export interface EngineOptions {
  container: HTMLElement;
  reducedMotion: boolean;
  onCountryClick: (a2: string) => void;
  onCompanyClick: (id: string) => void;
  onClusterOpen: (ids: string[], country: string | null) => void;
  onUnsupported: () => void;
  /** Fired once, after the first frame has actually been drawn. */
  onReady?: () => void;
  /** Fired when the 3D view cannot continue (render failure, lost context). */
  onError?: (message: string) => void;
}

const MIN_DIST = 1.28;
const CONTINENT_SPOTS: Record<string, [number, number]> = {
  NA: [46, -102], SA: [-15, -60], EU: [51, 14], AS: [47, 92], ME: [27, 45], AF: [4, 20], OC: [-25, 135],
};
export const CONTINENT_POSITIONS = CONTINENT_SPOTS;

export class GlobeEngine {
  private o: EngineOptions;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  private controls!: OrbitControls;
  private globe!: THREE.Mesh;
  private fitDist = 3.4;
  private userZoomed = false;
  private atmos!: ReturnType<typeof createAtmosphere>;
  private stars!: ReturnType<typeof createStars>;
  private network!: ReturnType<typeof createNetwork>;
  private highlight: ReturnType<typeof createHighlightLayer> | null = null;
  private overlay!: Overlay;
  private glow!: THREE.CanvasTexture;
  private baseTex: THREE.CanvasTexture | null = null;
  private world: WorldGeo | null = null;

  private points: MarkerPoint[] = [];
  private bucket = -1;
  private hover: string | null = null;
  private selected: string | null = null;
  private autoRotate = true;
  private idleTimer = 0;
  private fly: { t0: number; ms: number; from: THREE.Vector3; to: THREE.Vector3; r0: number; r1: number } | null = null;
  private down: { x: number; y: number; t: number } | null = null;
  private lastHover = 0;
  private visible = true;
  private running = false;
  private dead = false;
  private mobile: boolean;
  private nameOf: (a2: string) => string = (a) => a;
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private raycaster = new THREE.Raycaster();
  private t0 = performance.now();
  private firstFrame = false;
  private w = 1;
  private h = 1;

  constructor(options: EngineOptions) {
    this.o = options;
    this.mobile = window.matchMedia('(max-width: 768px)').matches;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: !this.mobile, alpha: true, powerPreference: 'high-performance' });
    } catch {
      this.dead = true;
    }
    if (this.dead || !this.renderer.getContext()) {
      this.dead = true;
      options.onUnsupported();
      this.ro = new ResizeObserver(() => undefined);
      this.io = new IntersectionObserver(() => undefined);
      return;
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none';
    r.domElement.setAttribute('aria-label', 'Interactive 3D globe');
    options.container.appendChild(r.domElement);

    this.glow = makeGlowTexture();
    this.stars = createStars(this.mobile ? 900 : 1700);
    this.scene.add(this.stars.points);

    this.globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 96),
      new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 14, specular: new THREE.Color(0x4c2a9a), emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.55 }),
    );
    this.scene.add(this.globe);

    this.atmos = createAtmosphere();
    this.scene.add(this.atmos.mesh);
    this.network = createNetwork(this.glow);
    this.scene.add(this.network.group);

    // Dynamic lighting: a key light that travels with the camera + a violet rim.
    this.scene.add(new THREE.AmbientLight(0x6d4bc4, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(-2.2, 1.8, 2.6);
    const rim = new THREE.DirectionalLight(0xa855f7, 1.1);
    rim.position.set(2.4, -0.6, -1.4);
    this.camera.add(key, rim);
    this.scene.add(this.camera);

    this.overlay = new Overlay(options.container);

    this.controls = new OrbitControls(this.camera, r.domElement);
    const c = this.controls;
    c.enablePan = false;
    c.enableDamping = true;
    c.dampingFactor = 0.07;
    c.minDistance = MIN_DIST;
    c.maxDistance = 4.8;
    c.zoomSpeed = 0.7;
    c.autoRotate = !options.reducedMotion;
    c.autoRotateSpeed = 0.45;
    c.addEventListener('start', this.onInteractStart);
    c.addEventListener('end', this.onInteractEnd);

    this.setView(18, -35, 3.4);

    r.domElement.addEventListener('pointerdown', this.onDown);
    r.domElement.addEventListener('pointerup', this.onUp);
    r.domElement.addEventListener('pointermove', this.onMove);
    r.domElement.addEventListener('pointerleave', this.onLeave);
    r.domElement.addEventListener('webglcontextlost', this.onContextLost);
    r.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(options.container);
    this.io = new IntersectionObserver((entries) => { this.visible = entries[0]?.isIntersecting ?? true; this.syncLoop(); });
    this.io.observe(options.container);
    document.addEventListener('visibilitychange', this.syncLoop);
    this.resize();
    this.syncLoop();
  }

  // ── public API ─────────────────────────────────────────────────────────────

  get supported() { return !this.dead; }

  /** Largest base-texture width this device can reasonably hold. */
  private textureSize(): number {
    const max = this.renderer.capabilities.maxTextureSize || 2048;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const want = this.mobile || mem < 4 ? 2048 : 4096;
    return Math.max(1024, Math.min(want, max));
  }

  setWorld(world: WorldGeo, covered: Set<string>, nameOf: (a2: string) => string, continentName: (code: string) => string) {
    if (this.dead) return;
    this.world = world;
    this.nameOf = nameOf;
    const size = this.textureSize();
    const tex = new THREE.CanvasTexture(buildBaseTexture(world, covered, size));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const mat = this.globe.material as THREE.MeshPhongMaterial;
    this.baseTex?.dispose();
    this.baseTex = tex;
    mat.map = tex;
    mat.emissiveMap = tex;
    mat.needsUpdate = true;

    this.highlight?.dispose();
    this.highlight?.mesh.removeFromParent();
    this.highlight = createHighlightLayer(world, Math.min(2048, size));
    this.scene.add(this.highlight.mesh);
    this.highlight.draw(this.hover, this.selected);

    this.setLabels(covered, nameOf);
    this.overlay.setContinentLabels(
      Object.entries(CONTINENT_SPOTS).map(([code, [lat, lon]]) => ({ name: continentName(code), lat, lon })),
    );
  }

  /** Re-translate all labels (language change). */
  setLabels(covered: Set<string>, nameOf: (a2: string) => string) {
    if (!this.world) return;
    this.nameOf = nameOf;
    const specs: LabelSpec[] = [];
    for (const c of this.world.countries) {
      if (!c.a2) continue;
      if (!covered.has(c.a2) && c.area < 60) continue;
      specs.push({ a2: c.a2, name: nameOf(c.a2), lat: c.centroid[0], lon: c.centroid[1], weight: c.area });
    }
    specs.sort((a, b) => Number(covered.has(b.a2)) - Number(covered.has(a.a2)) || b.weight - a.weight);
    this.overlay.setCountryLabels(specs);
  }

  setContinentNames(continentName: (code: string) => string) {
    if (this.dead) return;
    this.overlay.setContinentLabels(Object.entries(CONTINENT_SPOTS).map(([code, [lat, lon]]) => ({ name: continentName(code), lat, lon })));
  }

  setPoints(points: MarkerPoint[]) {
    this.points = points;
    this.bucket = -1; // force re-cluster on next frame
  }

  setSelected(a2: string | null) {
    this.selected = a2;
    this.highlight?.draw(this.hover, this.selected);
  }

  setAutoRotate(on: boolean) {
    this.autoRotate = on;
    if (this.dead) return;
    this.controls.autoRotate = on && !this.o.reducedMotion;
  }

  flyTo(lat: number, lon: number, dist = 2.1, ms = 1100) {
    if (this.dead) return;
    const [x, y, z] = toXYZ(lat, lon);
    const to = new THREE.Vector3(x, y, z).normalize();
    this.fly = { t0: performance.now(), ms: this.o.reducedMotion ? 1 : ms, from: this.camera.position.clone().normalize(), to, r0: this.camera.position.length(), r1: Math.min(Math.max(MIN_DIST, dist), this.fitDist) };
    this.controls.autoRotate = false;
  }

  dispose() {
    if (this.dead) return;
    this.dead = true;
    window.clearTimeout(this.idleTimer);
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.io.disconnect();
    document.removeEventListener('visibilitychange', this.syncLoop);
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerleave', this.onLeave);
    el.removeEventListener('webglcontextlost', this.onContextLost);
    el.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.controls.dispose();
    this.overlay.dispose();
    this.highlight?.dispose();
    this.network.dispose();
    this.atmos.dispose();
    this.stars.dispose();
    this.glow.dispose();
    this.baseTex?.dispose();
    (this.globe.geometry as THREE.BufferGeometry).dispose();
    (this.globe.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private setView(lat: number, lon: number, dist: number) {
    const [x, y, z] = toXYZ(lat, lon, dist);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
  }

  /** Camera distance at which the whole globe (plus a margin for the glow) fits the canvas. */
  private fitDistance(): number {
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * (this.w / this.h));
    return Math.max(2.8, 1.2 / Math.sin(Math.min(vHalf, hHalf)));
  }

  private resize = () => {
    if (this.dead) return;
    const rect = this.o.container.getBoundingClientRect();
    this.w = Math.max(1, Math.round(rect.width));
    this.h = Math.max(1, Math.round(rect.height));
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    const fit = this.fitDistance();
    this.controls.maxDistance = fit * 1.12;
    this.fitDist = fit;
    if (!this.fly) {
      const len = this.camera.position.length();
      if (!this.userZoomed) this.camera.position.setLength(fit);
      else if (len > this.controls.maxDistance) this.camera.position.setLength(this.controls.maxDistance);
    }
  };

  private syncLoop = () => {
    if (this.dead) return;
    const should = this.visible && !document.hidden;
    if (should && !this.running) { this.running = true; this.renderer.setAnimationLoop(this.tick); }
    if (!should && this.running) { this.running = false; this.renderer.setAnimationLoop(null); }
  };

  private onInteractStart = () => {
    this.userZoomed = true;
    window.clearTimeout(this.idleTimer);
    this.fly = null;
    this.controls.autoRotate = false;
  };

  private onInteractEnd = () => {
    window.clearTimeout(this.idleTimer);
    if (!this.autoRotate || this.o.reducedMotion) return;
    this.idleTimer = window.setTimeout(() => { this.controls.autoRotate = this.autoRotate; }, 4500);
  };

  private pickAt(clientX: number, clientY: number): { lat: number; lon: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.globe, false)[0];
    return hit ? fromXYZ(hit.point.x, hit.point.y, hit.point.z) : null;
  }

  private onContextLost = (e: Event) => {
    e.preventDefault(); // allows the browser to restore the context
    this.o.onError?.('WebGL context lost');
  };

  private onContextRestored = () => {
    this.firstFrame = false; // report ready again after the first restored frame
  };

  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() }; };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || !this.world) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 600) return;
    const p = this.pickAt(e.clientX, e.clientY);
    const a2 = p ? this.world.pointCountry(p.lat, p.lon) : null;
    if (a2) this.o.onCountryClick(a2);
  };

  private onMove = (e: PointerEvent) => {
    if (!this.world || e.pointerType !== 'mouse' || e.buttons !== 0) return;
    const now = performance.now();
    if (now - this.lastHover < 45) return;
    this.lastHover = now;
    const p = this.pickAt(e.clientX, e.clientY);
    const a2 = p ? this.world.pointCountry(p.lat, p.lon) : null;
    const rect = this.o.container.getBoundingClientRect();
    if (a2 !== this.hover) {
      this.hover = a2;
      this.highlight?.draw(this.hover, this.selected);
      this.renderer.domElement.style.cursor = a2 ? 'pointer' : 'grab';
    }
    this.overlay.showTip(e.clientX - rect.left, e.clientY - rect.top, a2 ? this.nameOf(a2) : null);
  };

  private onLeave = () => {
    if (this.hover) { this.hover = null; this.highlight?.draw(null, this.selected); }
    this.overlay.showTip(0, 0, null);
  };

  private rebuildClusters(dist: number) {
    const thr = Math.min(0.28, Math.max(0.012, 0.085 * (dist - 1.0)));
    const clusters = clusterPoints(this.points, thr);
    this.overlay.setClusters(
      clusters,
      (c) => this.onClusterClick(c),
      (c) => (c.count === 1 ? this.nameOf(c.country ?? '') : `${c.count}`),
    );
  }

  private onClusterClick(c: Cluster) {
    if (c.count === 1) { this.o.onCompanyClick(c.ids[0]); return; }
    const dist = this.camera.position.length();
    if (dist <= 1.7) { this.o.onClusterOpen(c.ids, c.country); return; }
    this.flyTo(c.lat, c.lon, Math.max(MIN_DIST + 0.05, dist * 0.55));
  }

  private tick = () => {
    if (this.dead) return;
    try {
      this.frame();
    } catch (err) {
      // Never let a render failure escape into the page: stop drawing and report it.
      console.error('[Radar globe] render failed', err);
      this.running = false;
      this.renderer.setAnimationLoop(null);
      this.o.onError?.(err instanceof Error ? err.message : String(err));
    }
  };

  private frame() {
    const t = (performance.now() - this.t0) / 1000;

    if (this.fly) {
      const f = this.fly;
      const k = Math.min(1, (performance.now() - f.t0) / f.ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const q = new THREE.Quaternion().setFromUnitVectors(f.from, f.to);
      const qt = new THREE.Quaternion().slerp(q, e);
      const dir = f.from.clone().applyQuaternion(qt);
      this.camera.position.copy(dir.multiplyScalar(f.r0 + (f.r1 - f.r0) * e));
      this.camera.lookAt(0, 0, 0);
      if (k >= 1) { this.fly = null; this.onInteractEnd(); }
    }

    const dist = this.camera.position.length();
    this.controls.rotateSpeed = Math.min(0.9, Math.max(0.18, (dist - 1.1) * 0.34));
    this.controls.update();

    const bucket = Math.round(dist * 5);
    if (bucket !== this.bucket) { this.bucket = bucket; this.rebuildClusters(dist); }

    this.atmos.material.uniforms.uPulse.value = 0.88 + 0.12 * Math.sin(t * 1.5);
    this.network.update(t);
    this.overlay.update(this.camera, this.w, this.h, dist, this.hover, this.selected);
    this.renderer.render(this.scene, this.camera);
    if (!this.firstFrame) { this.firstFrame = true; this.o.onReady?.(); }
  };
}
