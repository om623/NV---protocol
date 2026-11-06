import * as THREE from 'three';
import { toXYZ, type Cluster } from '../geo';

const STYLE_ID = 'radar-globe-style';
const CSS = `
.rg-root{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.rg-marker{position:absolute;left:0;top:0;pointer-events:auto;border:0;background:transparent;padding:0;cursor:pointer;will-change:transform;
  display:flex;align-items:center;justify-content:center;touch-action:manipulation}
.rg-marker:focus-visible{outline:2px solid #e9d5ff;outline-offset:3px;border-radius:999px}
.rg-dot{position:relative;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font:700 10px/1 'DM Sans',system-ui,sans-serif;
  background:radial-gradient(circle at 35% 30%,#e9d5ff,#a855f7 55%,#6d28d9);box-shadow:0 0 12px 2px rgba(168,85,247,.75),0 0 2px 1px rgba(255,255,255,.55) inset;
  transition:transform .15s ease}
.rg-marker:hover .rg-dot{transform:scale(1.18)}
.rg-dot::after{content:"";position:absolute;inset:-3px;border-radius:999px;border:1.5px solid rgba(192,132,252,.8);animation:rgPulse 2.6s ease-out infinite}
@keyframes rgPulse{0%{transform:scale(.8);opacity:.9}100%{transform:scale(2.3);opacity:0}}
.rg-label{position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;font:600 9.5px/1 'DM Sans',system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;
  color:rgba(233,222,255,.85);text-shadow:0 1px 3px rgba(8,2,24,.95),0 0 8px rgba(8,2,24,.9);will-change:transform}
.rg-label.hot{color:#fff}
.rg-cont{font-size:11px;letter-spacing:.2em;color:rgba(196,167,255,.75)}
.rg-tip{position:absolute;left:0;top:0;pointer-events:none;padding:4px 8px;border-radius:8px;background:rgba(18,8,44,.92);border:1px solid rgba(168,85,247,.45);
  color:#f3e8ff;font:600 11px/1.2 'DM Sans',system-ui,sans-serif;white-space:nowrap;opacity:0;transition:opacity .12s ease;will-change:transform}
@media (prefers-reduced-motion: reduce){.rg-dot::after{animation:none}}
`;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

interface Item { el: HTMLElement; v: THREE.Vector3; shown: boolean }
interface MarkerItem extends Item { cluster: Cluster }
interface LabelItem extends Item { a2: string; weight: number }
interface ContItem extends Item {}

export interface LabelSpec { a2: string; name: string; lat: number; lon: number; weight: number }

const tmp = new THREE.Vector3();
const toCam = new THREE.Vector3();

export class Overlay {
  root: HTMLDivElement;
  private markers: MarkerItem[] = [];
  private labels: LabelItem[] = [];
  private conts: ContItem[] = [];
  private tip: HTMLDivElement;
  private tipPos = { x: 0, y: 0, on: false };

  constructor(container: HTMLElement) {
    ensureStyle();
    this.root = document.createElement('div');
    this.root.className = 'rg-root';
    this.tip = document.createElement('div');
    this.tip.className = 'rg-tip';
    this.root.appendChild(this.tip);
    container.appendChild(this.root);
  }

  setClusters(clusters: Cluster[], onClick: (c: Cluster) => void, titleOf: (c: Cluster) => string) {
    for (const m of this.markers) m.el.remove();
    this.markers = clusters.map((cluster) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rg-marker';
      btn.setAttribute('aria-label', titleOf(cluster));
      btn.title = titleOf(cluster);
      const size = cluster.count === 1 ? 11 : Math.min(30, 16 + Math.log2(cluster.count) * 4.5);
      const dot = document.createElement('span');
      dot.className = 'rg-dot';
      dot.style.width = dot.style.height = `${size}px`;
      if (cluster.count > 1) dot.textContent = String(cluster.count);
      btn.appendChild(dot);
      btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(cluster); });
      this.root.appendChild(btn);
      const [x, y, z] = toXYZ(cluster.lat, cluster.lon, 1.012);
      return { el: btn, v: new THREE.Vector3(x, y, z), shown: true, cluster };
    });
  }

  setCountryLabels(specs: LabelSpec[]) {
    for (const l of this.labels) l.el.remove();
    this.labels = specs.map((s) => {
      const el = document.createElement('div');
      el.className = 'rg-label';
      el.textContent = s.name;
      this.root.appendChild(el);
      const [x, y, z] = toXYZ(s.lat, s.lon, 1.004);
      return { el, v: new THREE.Vector3(x, y, z), shown: true, a2: s.a2, weight: s.weight };
    });
  }

  setContinentLabels(items: { name: string; lat: number; lon: number }[]) {
    for (const c of this.conts) c.el.remove();
    this.conts = items.map((s) => {
      const el = document.createElement('div');
      el.className = 'rg-label rg-cont';
      el.textContent = s.name;
      this.root.appendChild(el);
      const [x, y, z] = toXYZ(s.lat, s.lon, 1.004);
      return { el, v: new THREE.Vector3(x, y, z), shown: true };
    });
  }

  showTip(x: number, y: number, text: string | null) {
    if (text === null) { this.tip.style.opacity = '0'; this.tipPos.on = false; return; }
    this.tip.textContent = text;
    this.tip.style.opacity = '1';
    this.tip.style.transform = `translate3d(${Math.round(x + 14)}px,${Math.round(y + 14)}px,0)`;
    this.tipPos = { x, y, on: true };
  }

  /** Project every item; called once per frame. */
  update(camera: THREE.PerspectiveCamera, w: number, h: number, dist: number, hover: string | null, selected: string | null) {
    const place = (item: Item, opacity: number, offsetY = 0) => {
      tmp.copy(item.v);
      toCam.copy(camera.position).sub(tmp);
      const facing = tmp.dot(toCam) > 0.06;
      if (!facing || opacity <= 0.01) {
        if (item.shown) { item.el.style.visibility = 'hidden'; item.shown = false; }
        return;
      }
      tmp.project(camera);
      if (!item.shown) { item.el.style.visibility = 'visible'; item.shown = true; }
      const x = (tmp.x * 0.5 + 0.5) * w;
      const y = (-tmp.y * 0.5 + 0.5) * h + offsetY;
      item.el.style.opacity = String(opacity);
      item.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%)`;
    };

    for (const m of this.markers) place(m, 1);

    const showLabels = dist < 2.15;
    let budget = 38;
    for (const l of this.labels) {
      const hot = l.a2 === hover || l.a2 === selected;
      l.el.classList.toggle('hot', hot);
      if (hot) { place(l, 1, 18); continue; }
      if (!showLabels || budget <= 0) { place(l, 0); continue; }
      budget--;
      place(l, 0.85, 18);
    }

    const contOpacity = Math.max(0, Math.min(1, (dist - 2.45) / 0.7)) * 0.9;
    for (const c of this.conts) place(c, contOpacity);
  }

  dispose() {
    this.root.remove();
    this.markers = [];
    this.labels = [];
    this.conts = [];
  }
}
