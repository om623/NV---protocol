import * as THREE from 'three';
import type { WorldGeo } from '../geo';
import { toXYZ } from '../geo';
import { CITIES, HUBS, HUB_LINKS } from '../data/cities';

type Ring = [number, number][];

// ── Land / ocean texture painted from real country polygons ──────────────────

function strokeLines(ctx: CanvasRenderingContext2D, lines: Ring[], W: number, H: number) {
  const px = (lon: number) => ((lon + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;
  ctx.beginPath();
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [x0, y0] = line[i - 1];
      const [x1, y1] = line[i];
      // skip the artificial cut along the antimeridian (data is clipped at +/-180)
      if (Math.abs(x0) > 179.99 && Math.abs(x1) > 179.99 && Math.sign(x0) === Math.sign(x1)) continue;
      if (Math.abs(x1 - x0) > 180) continue;
      ctx.moveTo(px(x0), py(y0));
      ctx.lineTo(px(x1), py(y1));
    }
  }
  ctx.stroke();
}

export function buildBaseTexture(world: WorldGeo, covered: Set<string>, W: number): HTMLCanvasElement {
  const H = W / 2;
  const s = W / 4096;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // The browser refused a canvas this large (memory pressure): retry at half size
    // instead of handing the GPU a blank texture, which renders as a dark sphere.
    if (W > 1024) return buildBaseTexture(world, covered, W / 2);
    throw new Error('2D canvas is unavailable');
  }
  const px = (lon: number) => ((lon + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;

  const ocean = ctx.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0, '#0e0728');
  ocean.addColorStop(0.5, '#190c3d');
  ocean.addColorStop(1, '#0e0728');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, W, H);

  // graticule
  ctx.strokeStyle = 'rgba(139,92,246,0.11)';
  ctx.lineWidth = Math.max(1, s);
  ctx.beginPath();
  for (let lon = -180; lon <= 180; lon += 15) { ctx.moveTo(px(lon), 0); ctx.lineTo(px(lon), H); }
  for (let lat = -75; lat <= 75; lat += 15) { ctx.moveTo(0, py(lat)); ctx.lineTo(W, py(lat)); }
  ctx.stroke();

  // land: covered countries (with companies in the directory) are slightly brighter
  for (const tint of [false, true]) {
    ctx.fillStyle = tint ? '#3a1d85' : '#241254';
    ctx.beginPath();
    for (const c of world.countries) {
      if (covered.has(c.a2) !== tint) continue;
      for (const poly of c.polygons) {
        for (const ring of poly) {
          ring.forEach(([lon, lat], i) => (i === 0 ? ctx.moveTo(px(lon), py(lat)) : ctx.lineTo(px(lon), py(lat))));
          ctx.closePath();
        }
      }
    }
    ctx.fill('evenodd');
  }

  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(139,92,246,0.45)';
  ctx.lineWidth = Math.max(0.8, 0.9 * s);
  strokeLines(ctx, world.borders, W, H);

  ctx.strokeStyle = 'rgba(167,139,250,0.16)';
  ctx.lineWidth = 3.2 * s;
  strokeLines(ctx, world.coasts, W, H);
  ctx.strokeStyle = 'rgba(206,182,255,0.85)';
  ctx.lineWidth = Math.max(1, 1.15 * s);
  strokeLines(ctx, world.coasts, W, H);

  return canvas;
}

// ── Country highlight overlay (hover / selected) ─────────────────────────────

export function createHighlightLayer(world: WorldGeo, width = 2048) {
  const W = width, H = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.SphereGeometry(1.003, 96, 64);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(geometry, material);
  const px = (lon: number) => ((lon + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;

  function paint(a2: string, fill: string, stroke: string, lw: number) {
    if (!ctx) return;
    ctx.beginPath();
    for (const c of world.countries) {
      if (c.a2 !== a2) continue;
      for (const poly of c.polygons) for (const ring of poly) {
        ring.forEach(([lon, lat], i) => (i === 0 ? ctx.moveTo(px(lon), py(lat)) : ctx.lineTo(px(lon), py(lat))));
        ctx.closePath();
      }
    }
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw * (W / 2048);
    ctx.stroke();
  }

  function draw(hover: string | null, selected: string | null) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (hover && hover !== selected) paint(hover, 'rgba(168,85,247,0.10)', 'rgba(216,180,254,0.65)', 0.9);
    if (selected) paint(selected, 'rgba(168,85,247,0.20)', 'rgba(236,222,255,0.95)', 1.3);
    texture.needsUpdate = true;
  }

  return { mesh, draw, dispose: () => { geometry.dispose(); material.dispose(); texture.dispose(); } };
}

// ── Glow sprite, atmosphere, stars ───────────────────────────────────────────

export function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createAtmosphere() {
  const geometry = new THREE.SphereGeometry(1, 64, 48);
  const material = new THREE.ShaderMaterial({
    uniforms: { uPulse: { value: 1 }, uColor: { value: new THREE.Color(0x9b5cf6) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; uniform float uPulse; uniform vec3 uColor;
      void main(){ float t = clamp(-dot(vN, vV) / 0.5, 0.0, 1.0); float f = pow(t, 2.6); gl_FragColor = vec4(uColor, 1.0) * f * 0.8 * uPulse; }`,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(1.12);
  return { mesh, material, dispose: () => { geometry.dispose(); material.dispose(); } };
}

export function createStars(count: number) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 30 + Math.random() * 40;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const material = new THREE.PointsMaterial({ color: 0xcdbcff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.75, depthWrite: false });
  return { points: new THREE.Points(geometry, material), dispose: () => { geometry.dispose(); material.dispose(); } };
}

// ── Hub network: arcs + travelling pulses ────────────────────────────────────
// Illustrative network between major economic centres. It does NOT encode trade volume.

export function createNetwork(glow: THREE.Texture) {
  const hubMap = new Map(HUBS.map((h) => [h.id, h]));
  const vec = (city: string) => {
    const [lat, lon] = CITIES[city];
    const [x, y, z] = toXYZ(lat, lon);
    return new THREE.Vector3(x, y, z);
  };

  const arcPoints: THREE.Vector3[][] = [];
  const segs: number[] = [];
  for (const [a, b] of HUB_LINKS) {
    const ha = hubMap.get(a), hb = hubMap.get(b);
    if (!ha || !hb) continue;
    const va = vec(ha.city), vb = vec(hb.city);
    const angle = va.angleTo(vb);
    const n = Math.max(24, Math.ceil(angle * 42));
    const lift = 0.035 + 0.15 * (angle / Math.PI);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(va.clone().lerp(vb, t).normalize().multiplyScalar(1.004 + lift * Math.sin(Math.PI * t)));
    }
    for (let i = 1; i < pts.length; i++) segs.push(pts[i - 1].x, pts[i - 1].y, pts[i - 1].z, pts[i].x, pts[i].y, pts[i].z);
    arcPoints.push(pts);
  }

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xb48bff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);

  const pulsePos = new Float32Array(arcPoints.length * 3);
  const pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
  const pulseMat = new THREE.PointsMaterial({ color: 0xf1e6ff, size: 9, sizeAttenuation: false, map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pulses = new THREE.Points(pulseGeo, pulseMat);

  const hubPos: number[] = [];
  for (const h of HUBS) { const v = vec(h.city).multiplyScalar(1.006); hubPos.push(v.x, v.y, v.z); }
  const hubGeo = new THREE.BufferGeometry();
  hubGeo.setAttribute('position', new THREE.Float32BufferAttribute(hubPos, 3));
  const hubMat = new THREE.PointsMaterial({ color: 0xd8b4fe, size: 13, sizeAttenuation: false, map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const hubs = new THREE.Points(hubGeo, hubMat);

  const group = new THREE.Group();
  group.add(lines, pulses, hubs);

  function update(t: number) {
    for (let i = 0; i < arcPoints.length; i++) {
      const pts = arcPoints[i];
      const u = (t * (0.07 + (i % 5) * 0.012) + i * 0.173) % 1;
      const p = pts[Math.min(pts.length - 1, Math.floor(u * (pts.length - 1)))];
      pulsePos[i * 3] = p.x; pulsePos[i * 3 + 1] = p.y; pulsePos[i * 3 + 2] = p.z;
    }
    (pulseGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    hubMat.size = 12 + Math.sin(t * 2.1) * 2.5;
  }

  return {
    group,
    update,
    dispose: () => { lineGeo.dispose(); lineMat.dispose(); pulseGeo.dispose(); pulseMat.dispose(); hubGeo.dispose(); hubMat.dispose(); },
  };
}
