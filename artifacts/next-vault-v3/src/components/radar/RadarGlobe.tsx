import { useEffect, useRef } from 'react';
import type { RadarCompany } from '@/lib/radar/types';

interface RadarGlobeProps {
  companies: RadarCompany[];
  selectedId?: string;
  onSelect: (company: RadarCompany) => void;
}

interface ProjectedPoint { x: number; y: number; z: number; company: RadarCompany; }

const DEG = Math.PI / 180;

function project(lat: number, lon: number, rotation: number, radius: number, cx: number, cy: number) {
  const rlat = lat * DEG;
  const rlon = lon * DEG + rotation;
  const x = Math.cos(rlat) * Math.sin(rlon);
  const y = Math.sin(rlat);
  const z = Math.cos(rlat) * Math.cos(rlon);
  return { x: cx + x * radius, y: cy - y * radius, z };
}

// Simplified continent outlines [lat, lon] for landmass silhouette
const CONTINENTS: number[][][] = [
  // North America
  [[70,-160],[70,-90],[55,-75],[45,-65],[30,-80],[25,-95],[20,-105],[25,-110],[40,-125],[55,-130],[60,-145],[68,-165]],
  // South America
  [[10,-75],[5,-50],[-15,-35],[-25,-45],[-40,-62],[-55,-70],[-15,-82],[0,-78],[10,-75]],
  // Europe
  [[70,-10],[70,40],[55,40],[45,30],[40,15],[45,-5],[55,-10],[60,-5],[70,-10]],
  // Africa
  [[35,-5],[35,25],[15,40],[0,40],[-15,40],[-35,20],[-35,15],[-15,12],[5,-5],[15,-18],[30,-12],[35,-5]],
  // Asia
  [[70,40],[70,180],[55,160],[40,140],[30,120],[20,110],[10,105],[5,100],[20,85],[30,70],[40,50],[50,45],[60,50],[70,40]],
  // Australia
  [[-12,130],[-15,145],[-25,153],[-38,145],[-35,138],[-32,115],[-22,113],[-15,115],[-12,130]],
  // Middle East / Arabian peninsula
  [[28,35],[28,55],[15,55],[12,43],[20,38],[28,35]],
];

export function RadarGlobe({ companies, selectedId, onSelect }: RadarGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(-0.5);
  const zoomRef = useRef(1);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pointsRef = useRef<ProjectedPoint[]>([]);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const baseRadius = Math.min(w, h) * 0.34;
      const radius = Math.max(40, baseRadius * zoomRef.current);

      if (!draggingRef.current) rotationRef.current += 0.0006;

      ctx.clearRect(0, 0, w, h);

      // Atmospheric glow
      const glow = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.4, radius * 0.1, cx, cy, radius * 1.2);
      glow.addColorStop(0, 'rgba(168, 85, 247, 0.30)');
      glow.addColorStop(0.6, 'rgba(59, 16, 120, 0.85)');
      glow.addColorStop(1, 'rgba(8, 6, 20, 1)');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Clip to globe
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // Graticule
      ctx.strokeStyle = 'rgba(196, 160, 255, 0.10)';
      ctx.lineWidth = 0.8;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        for (let lon = -180; lon <= 180; lon += 4) {
          const p = project(lat, lon, rotationRef.current, radius, cx, cy);
          if (lon === -180) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        for (let lat = -90; lat <= 90; lat += 4) {
          const p = project(lat, lon, rotationRef.current, radius, cx, cy);
          if (lat === -90) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Continents — filled silhouettes
      ctx.fillStyle = 'rgba(147, 100, 230, 0.22)';
      ctx.strokeStyle = 'rgba(186, 142, 255, 0.35)';
      ctx.lineWidth = 1;
      for (const continent of CONTINENTS) {
        ctx.beginPath();
        for (let i = 0; i < continent.length; i++) {
          const [lat, lon] = continent[i];
          const p = project(lat, lon, rotationRef.current, radius, cx, cy);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      // Company points
      const points: ProjectedPoint[] = companies
        .map(company => {
          const p = project(company.latitude, company.longitude, rotationRef.current, radius, cx, cy);
          return { x: p.x, y: p.y, z: p.z, company };
        })
        .filter(pt => pt.z > -0.15);
      pointsRef.current = points;

      // Group nearby points
      const groups = new Map<string, ProjectedPoint[]>();
      for (const pt of points) {
        const key = `${Math.round(pt.x / 24)}:${Math.round(pt.y / 24)}`;
        const arr = groups.get(key);
        if (arr) arr.push(pt); else groups.set(key, [pt]);
      }

      // Connection arcs between major hubs
      ctx.strokeStyle = 'rgba(200, 150, 255, 0.18)';
      ctx.lineWidth = 0.9;
      const visibleHubs = points.filter(pt => pt.z > 0.25);
      for (let i = 0; i < visibleHubs.length; i++) {
        const from = visibleHubs[i];
        const to = visibleHubs[(i + 2) % visibleHubs.length];
        if (from === to) continue;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        const midX = (from.x + to.x) / 2;
        const midY = cy - radius * 0.4;
        ctx.quadraticCurveTo(midX, midY, to.x, to.y);
        ctx.stroke();
      }

      // Render grouped markers
      for (const group of groups.values()) {
        const first = group[0];
        const active = group.some(pt => pt.company.id === selectedRef.current);
        const size = Math.min(10, 4 + Math.log2(group.length + 1) * 2.2);
        ctx.beginPath();
        ctx.arc(first.x, first.y, size, 0, Math.PI * 2);
        ctx.fillStyle = active ? '#f3d8ff' : '#b879ff';
        ctx.shadowColor = '#a84dff';
        ctx.shadowBlur = active ? 24 : 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        if (group.length > 1) {
          ctx.fillStyle = '#1a0d30';
          ctx.font = 'bold 9px Space Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(group.length), first.x, first.y);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [companies]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = true;
    lastXRef.current = e.clientX;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    rotationRef.current += (e.clientX - lastXRef.current) * 0.008;
    lastXRef.current = e.clientX;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    // Resume auto-rotation after 2.5s
    resumeTimerRef.current = setTimeout(() => { /* auto-resume handled by draw loop */ }, 2500);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    zoomRef.current = Math.max(0.75, Math.min(1.4, zoomRef.current - e.deltaY * 0.0008));
  };

  const handleClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const sorted = pointsRef.current
      .map(pt => ({ pt, dist: Math.hypot(pt.x - x, pt.y - y) }))
      .sort((a, b) => a.dist - b.dist);
    const hit = sorted[0];
    if (hit && hit.dist < 30) {
      onSelectRef.current(hit.pt.company);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label="Interactive 3D business intelligence globe"
      className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      onWheel={handleWheel}
    />
  );
}
