// ─── Geodata: real country geometry (Natural Earth via world-atlas) ───────────
// Loaded lazily as a static asset. Used to paint the globe texture, pick the
// country under the cursor (point-in-polygon) and place labels.

import { feature, mesh } from 'topojson-client';
import { a2FromNumeric } from './data/countries';

type Ring = [number, number][];
type Polygon = Ring[]; // outer ring + holes, [lon, lat]

export interface CountryGeo {
  a2: string;
  /** English name from the dataset (display names come from Intl.DisplayNames) */
  name: string;
  polygons: Polygon[];
  /** [minLon, minLat, maxLon, maxLat] per polygon */
  boxes: [number, number, number, number][];
  /** [lat, lon] centre of the largest polygon, for labels */
  centroid: [number, number];
  area: number;
}

export interface WorldGeo {
  countries: CountryGeo[];
  byA2: Map<string, CountryGeo>;
  /** Interior borders (between two countries), as polylines of [lon, lat] */
  borders: Ring[];
  /** Coastlines / outer edges */
  coasts: Ring[];
  pointCountry: (lat: number, lon: number) => string | null;
}

function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return Math.abs(a / 2);
}

function ringCentroid(r: Ring): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f;
    cx += (r[j][0] + r[i][0]) * f;
    cy += (r[j][1] + r[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) return [r[0][1], r[0][0]];
  a *= 3;
  return [cy / a, cx / a];
}

function inRing(lon: number, lat: number, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lon: number, lat: number, p: Polygon): boolean {
  if (!inRing(lon, lat, p[0])) return false;
  for (let h = 1; h < p.length; h++) if (inRing(lon, lat, p[h])) return false;
  return true;
}

/** Build the world model from a TopoJSON topology (world-atlas countries). Pure: no I/O. */
export function buildWorld(input: unknown): WorldGeo {
  type TopoArg = Parameters<typeof feature>[0];
  type MeshObj = Parameters<typeof mesh>[1];
  type TopoObj = Exclude<Parameters<typeof feature>[1], string>;
  const topo = input as TopoArg;
  const obj = (topo as unknown as { objects: { countries: TopoObj } }).objects.countries;
  const fc = feature(topo, obj) as unknown as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { name?: string }>;

  const countries: CountryGeo[] = [];
  for (const f of fc.features) {
    const geom = f.geometry;
    if (!geom) continue;
    const polys = (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates) as unknown as Polygon[];
    const a2 = a2FromNumeric(f.id as string | number | undefined) ?? '';
    const boxes = polys.map((p) => {
      let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
      for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return [x0, y0, x1, y1] as [number, number, number, number];
    });
    let big = 0, bigArea = -1, total = 0;
    polys.forEach((p, i) => {
      const a = ringArea(p[0]);
      total += a;
      if (a > bigArea) { bigArea = a; big = i; }
    });
    countries.push({ a2, name: f.properties?.name ?? a2, polygons: polys, boxes, centroid: ringCentroid(polys[big][0]), area: total });
  }

  const lines = (g: GeoJSON.MultiLineString): Ring[] => g.coordinates as Ring[];
  const borders = lines(mesh(topo, obj as unknown as MeshObj, (a, b) => a !== b) as GeoJSON.MultiLineString);
  const coasts = lines(mesh(topo, obj as unknown as MeshObj, (a, b) => a === b) as GeoJSON.MultiLineString);

  const byA2 = new Map<string, CountryGeo>();
  for (const c of countries) {
    const prev = c.a2 ? byA2.get(c.a2) : undefined;
    if (c.a2 && (!prev || c.area > prev.area)) byA2.set(c.a2, c);
  }

  const pointCountry = (lat: number, lon: number): string | null => {
    // Enclaves (Hong Kong, Macau, small states) can overlap a larger country's polygon:
    // the most specific (smallest) match wins.
    let best: CountryGeo | null = null;
    for (const c of countries) {
      for (let i = 0; i < c.polygons.length; i++) {
        const b = c.boxes[i];
        if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
        if (inPolygon(lon, lat, c.polygons[i])) {
          if (!best || c.area < best.area) best = c;
          break;
        }
      }
    }
    return best ? best.a2 || null : null;
  };

  return { countries, byA2, borders, coasts, pointCountry };
}

// ── Sphere math (matches three.js SphereGeometry UV layout) ──────────────────

const D2R = Math.PI / 180;

export function toXYZ(lat: number, lon: number, r = 1): [number, number, number] {
  const phi = (lon + 180) * D2R;
  const theta = (90 - lat) * D2R;
  return [-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta)];
}

export function fromXYZ(x: number, y: number, z: number): { lat: number; lon: number } {
  const r = Math.hypot(x, y, z) || 1;
  const lat = Math.asin(Math.max(-1, Math.min(1, y / r))) / D2R;
  let lon = Math.atan2(z, -x) / D2R - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

// ── Marker clustering (angular distance on the sphere) ───────────────────────

export interface MarkerPoint {
  id: string;
  lat: number;
  lon: number;
  country: string;
  /** importance: larger first */
  weight: number;
}

export interface Cluster {
  key: string;
  lat: number;
  lon: number;
  count: number;
  ids: string[];
  /** set when every member shares one country */
  country: string | null;
}

export function clusterPoints(points: MarkerPoint[], thresholdRad: number): Cluster[] {
  const cosT = Math.cos(thresholdRad);
  const sorted = [...points].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  const acc: { v: [number, number, number]; sum: [number, number, number]; members: MarkerPoint[] }[] = [];
  for (const p of sorted) {
    const v = toXYZ(p.lat, p.lon);
    let target: (typeof acc)[number] | undefined;
    for (const c of acc) {
      if (c.v[0] * v[0] + c.v[1] * v[1] + c.v[2] * v[2] >= cosT) { target = c; break; }
    }
    if (!target) {
      target = { v, sum: [0, 0, 0], members: [] };
      acc.push(target);
    }
    target.members.push(p);
    target.sum[0] += v[0]; target.sum[1] += v[1]; target.sum[2] += v[2];
  }
  return acc.map((c) => {
    const { lat, lon } = fromXYZ(c.sum[0], c.sum[1], c.sum[2]);
    const countries = new Set(c.members.map((m) => m.country));
    return {
      key: c.members.map((m) => m.id).sort().join(','),
      lat,
      lon,
      count: c.members.length,
      ids: c.members.map((m) => m.id),
      country: countries.size === 1 ? c.members[0].country : null,
    };
  });
}
