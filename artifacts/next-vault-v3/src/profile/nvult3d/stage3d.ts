import * as THREE from 'three';
import { Disposer, type Kit, cyl, tor, mesh, glowSprite, disposeObject, TAU } from './primitives';

export interface StageFx {
  group: THREE.Group; // static scenery (pedestal, cone, particles)
  lights: THREE.Light[];
  pulse(amount: number): void; // shockwave when something is equipped
  tick(t: number, dt: number, still: boolean): void;
  dispose(): void;
}

/** A dark "studio" used only to generate reflections (PMREM). Panels of light make the metal read as metal. */
export function buildEnvScene(): THREE.Scene {
  const sc = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 14), new THREE.MeshBasicMaterial({ color: 0x06090f, side: THREE.BackSide }));
  sc.add(room);
  const panel = (w: number, h: number, color: number, intensity: number, x: number, y: number, z: number, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    sc.add(m);
  };
  panel(6, 4, 0xffffff, 3.2, 0, 3.9, 0, 0, Math.PI / 2); // top softbox
  panel(1.6, 5, 0xcfe0ff, 2.6, -6.8, 1, 1.5, Math.PI / 2); // cool strip, left
  panel(1.6, 5, 0xffe6c8, 2.2, 6.8, 1, 1.5, Math.PI / 2); // warm strip, right
  panel(8, 0.8, 0x7ffbe9, 2.0, 0, 0.4, -6.8); // accent-ish strip behind
  panel(5, 2, 0xffffff, 1.1, 0, 1.2, 6.8); // front fill
  return sc;
}

export function buildStage(kit: Kit): StageFx {
  const d = new Disposer();
  const { mats, q, tex } = kit;
  const s = q.segments;
  const group = new THREE.Group();
  const ring = (R: number, r: number, y: number, mat: THREE.Material) => {
    const m = mesh(tor(d, R, r, s * 2), mat, 0, y, 0);
    m.rotation.x = Math.PI / 2;
    m.castShadow = false;
    group.add(m);
    return m;
  };

  // pedestal: three tiers, the top one carrying the emissive grid
  const base = mesh(cyl(d, 1.26, 1.34, 0.16, s * 3), mats.dark, 0, -0.18, 0);
  const mid = mesh(cyl(d, 1.08, 1.2, 0.08, s * 3), mats.trim, 0, -0.06, 0);
  const topMat = d.mat(new THREE.MeshStandardMaterial({ color: 0x080d14, metalness: 0.85, roughness: 0.32, emissive: 0x2dd4bf, emissiveMap: tex.grid(), emissiveIntensity: 0.55, envMapIntensity: 1.2 }));
  mats.followAccent({ color: topMat.emissive });
  const top = mesh(cyl(d, 0.94, 1.0, 0.04, s * 3), topMat, 0, -0.02, 0);
  topMat.emissiveMap?.repeat.set(1, 1);
  [base, mid, top].forEach((m) => {
    m.castShadow = false;
    m.receiveShadow = true;
    group.add(m);
  });
  ring(0.96, 0.012, 0.002, mats.floor);
  ring(1.22, 0.008, -0.1, mats.floor);
  ring(1.3, 0.006, -0.2, mats.floor);

  // segmented ring that slowly turns
  const seg = new THREE.Group();
  const segGeo = d.geo(new THREE.BoxGeometry(0.16, 0.02, 0.05));
  const n = q.tier === 'low' ? 14 : 24;
  for (let i = 0; i < n; i++) {
    if (i % 3 === 2) continue;
    const a = (i / n) * TAU;
    const b = mesh(segGeo, mats.floor, Math.cos(a) * 1.1, -0.095, Math.sin(a) * 1.1);
    b.rotation.y = -a + Math.PI / 2;
    b.castShadow = false;
    seg.add(b);
  }
  group.add(seg);

  // projector posts
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const x = Math.cos(a) * 1.12;
    const z = Math.sin(a) * 1.12;
    const post = new THREE.Group();
    post.position.set(x, 0, z);
    post.add(mesh(cyl(d, 0.03, 0.04, 0.32, 8), mats.trim, 0, 0.14, 0));
    post.add(mesh(d.geo(new THREE.SphereGeometry(0.04, 10, 8)), mats.accent, 0, 0.32, 0));
    const g = glowSprite(kit, 0.34, 0.8);
    g.position.set(0, 0.33, 0);
    post.add(g);
    group.add(post);
  }

  // holographic light cone: brightest where you look through it, transparent at the silhouette so it has no hard edges
  const coneU = { uColor: { value: new THREE.Color(0x2dd4bf) }, uOpacity: { value: 0.16 } };
  const coneMat = d.mat(
    new THREE.ShaderMaterial({
      uniforms: coneU,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = uv.y; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float fade = pow(1.0 - vY, 1.4); gl_FragColor = vec4(uColor, uOpacity * f * fade); }',
    }),
  );
  mats.followAccent({ color: coneU.uColor.value });
  const cone = mesh(d.geo(new THREE.CylinderGeometry(0.98, 1.06, 2.9, s * 2, 1, true)), coneMat, 0, 1.45, 0);
  cone.castShadow = false;
  group.add(cone);

  // contact shadow under the feet
  const shMat = d.mat(new THREE.MeshBasicMaterial({ map: tex.glow(), color: 0x000000, transparent: true, opacity: 0.7, depthWrite: false }));
  const sh = mesh(d.geo(new THREE.PlaneGeometry(1.6, 1.6)), shMat, 0, 0.004, 0);
  sh.rotation.x = -Math.PI / 2;
  sh.castShadow = false;
  group.add(sh);

  // rising particles
  const N = q.particles;
  const pos = new Float32Array(N * 3);
  const spd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * TAU;
    const r = 0.25 + Math.random() * 0.85;
    pos.set([Math.cos(a) * r, Math.random() * 2.5, Math.sin(a) * r], i * 3);
    spd[i] = 0.06 + Math.random() * 0.14;
  }
  const pg = d.geo(new THREE.BufferGeometry());
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = d.mat(new THREE.PointsMaterial({ size: 0.035, map: tex.glow(), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: true }));
  mats.followAccent(pm);
  const points = new THREE.Points(pg, pm);
  points.frustumCulled = false;
  group.add(points);

  // shockwave ring (played when a part is equipped)
  const waveMat = d.mat(new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  mats.followAccent(waveMat);
  const wave = mesh(d.geo(new THREE.RingGeometry(0.9, 1, s * 3)), waveMat, 0, 0.01, 0);
  wave.rotation.x = -Math.PI / 2;
  wave.castShadow = false;
  group.add(wave);
  let waveT = 1;

  // lights
  const key = new THREE.DirectionalLight(0xfff1e0, 1.9);
  key.position.set(2.4, 4.2, 3.2);
  key.target.position.set(0, 1, 0);
  if (q.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    const c = key.shadow.camera;
    c.left = -1.6; c.right = 1.6; c.top = 2.6; c.bottom = -0.4; c.near = 1; c.far = 10;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 4;
  }
  const rimR = new THREE.PointLight(0x2dd4bf, 9, 7, 2);
  rimR.position.set(1.8, 1.9, -2.2);
  mats.followAccent(rimR);
  const rimL = new THREE.PointLight(0x6aa4ff, 8, 7, 2);
  rimL.position.set(-2.1, 1.6, -1.8);
  const under = new THREE.PointLight(0x2dd4bf, 2.2, 3.4, 2);
  under.position.set(0, 0.35, 0);
  mats.followAccent(under);
  const fill = new THREE.HemisphereLight(0xa8b8ff, 0x0b1018, 0.32);
  const lights: THREE.Light[] = [key, key.target as unknown as THREE.Light, rimR, rimL, under, fill];

  return {
    group,
    lights,
    pulse() {
      waveT = 0;
    },
    tick(t, dt, still) {
      if (still) return;
      seg.rotation.y = t * 0.12;
      const a = pg.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) {
        let y = a.getY(i) + spd[i] * dt;
        if (y > 2.6) y = 0;
        a.setY(i, y);
      }
      a.needsUpdate = true;
      coneU.uOpacity.value = 0.15 + 0.04 * Math.sin(t * 1.3);
      if (waveT < 1) {
        waveT = Math.min(1, waveT + dt / 0.7);
        wave.scale.setScalar(0.5 + waveT * 1.5);
        waveMat.opacity = (1 - waveT) * 0.8;
      }
    },
    dispose() {
      disposeObject(group, kit);
      d.dispose();
      group.removeFromParent();
    },
  };
}
