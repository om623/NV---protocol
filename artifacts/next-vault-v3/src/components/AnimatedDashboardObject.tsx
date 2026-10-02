import { useEffect, useRef } from 'react';

type Point = {
  x: number;
  y: number;
};

type Footprint = {
  x: number;
  y: number;
  angle: number;
  age: number;
  side: number;
};

type WebNode = {
  x: number;
  y: number;
  created: number;
};

type WebLine = {
  a: number;
  b: number;
  created: number;
};

export function AnimatedDashboardObject() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    let animationFrame = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = 1;

    let lastTime = performance.now();
    let elapsed = 0;

    const creature: Point = {
      x: width * 0.52,
      y: height * 0.42,
    };

    const velocity: Point = {
      x: 0,
      y: 0,
    };

    const target: Point = {
      x: width * 0.65,
      y: height * 0.4,
    };

    let directionTimer = 0;
    let pauseTimer = 0;
    let webTimer = 0;

    let mouseX = width * 0.5;
    let mouseY = height * 0.5;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    const footprints: Footprint[] = [];
    const webNodes: WebNode[] = [];
    const webLines: WebLine[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);

      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      creature.x = Math.min(creature.x, width - 40);
      creature.y = Math.min(creature.y, height - 40);
    };

    const chooseNewTarget = () => {
      const margin = Math.min(80, width * 0.08);

      target.x =
        margin +
        Math.random() * Math.max(1, width - margin * 2);

      target.y =
        margin +
        Math.random() * Math.max(1, height - margin * 2);

      directionTimer = 3500 + Math.random() * 6500;

      // Occasionally make the creature pause.
      if (Math.random() < 0.22) {
        pauseTimer = 700 + Math.random() * 1800;
      }
    };

    const distance = (a: Point, b: Point) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const addFootprints = () => {
      if (velocity.x === 0 && velocity.y === 0) return;

      const angle = Math.atan2(velocity.y, velocity.x);

      footprints.push({
        x: creature.x,
        y: creature.y,
        angle,
        age: 0,
        side: footprints.length % 2 === 0 ? -1 : 1,
      });

      // Keep the visual history light.
      if (footprints.length > 90) {
        footprints.shift();
      }
    };

    const buildWeb = () => {
      // The creature occasionally chooses its current location
      // as a new web anchor.
      if (webNodes.length >= 12) {
        webNodes.shift();

        for (let i = webLines.length - 1; i >= 0; i--) {
          if (
            webLines[i].a === 0 ||
            webLines[i].b === 0
          ) {
            webLines.splice(i, 1);
          }
        }

        for (const line of webLines) {
          line.a = Math.max(0, line.a - 1);
          line.b = Math.max(0, line.b - 1);
        }
      }

      const node: WebNode = {
        x: creature.x,
        y: creature.y,
        created: elapsed,
      };

      const newIndex = webNodes.push(node) - 1;

      // Connect the new point to nearby points.
      const nearby = webNodes
        .map((other, index) => ({
          index,
          distance: distance(node, other),
        }))
        .filter(
          item =>
            item.index !== newIndex &&
            item.distance < Math.min(width, height) * 0.3
        )
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);

      for (const item of nearby) {
        webLines.push({
          a: newIndex,
          b: item.index,
          created: elapsed,
        });
      }

      webTimer = 9000 + Math.random() * 10000;
    };

    const drawWebs = () => {
      ctx.save();

      for (const line of webLines) {
        const a = webNodes[line.a];
        const b = webNodes[line.b];

        if (!a || !b) continue;

        const age = elapsed - line.created;
        const opacity = Math.max(
          0,
          Math.min(1, age / 1800)
        );

        ctx.strokeStyle = `rgba(0,229,188,${0.08 * opacity})`;
        ctx.lineWidth = 0.7;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (const node of webNodes) {
        const age = elapsed - node.created;
        const opacity = Math.max(
          0,
          Math.min(1, age / 1500)
        );

        ctx.fillStyle = `rgba(0,229,188,${0.22 * opacity})`;

        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const drawFootprints = () => {
      ctx.save();

      for (const footprint of footprints) {
        const alpha = Math.max(
          0,
          0.22 * (1 - footprint.age / 7000)
        );

        if (alpha <= 0) continue;

        ctx.save();

        ctx.translate(
          footprint.x,
          footprint.y
        );

        ctx.rotate(footprint.angle);

        const offset = footprint.side * 5;

        ctx.strokeStyle = `rgba(80,220,255,${alpha})`;
        ctx.lineWidth = 0.8;

        ctx.beginPath();
        ctx.moveTo(offset, -2);
        ctx.lineTo(offset + 3, -5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset + 4, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(offset, 2);
        ctx.lineTo(offset + 3, 5);
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();
    };

    const drawCreature = (time: number) => {
      const angle = Math.atan2(
        velocity.y,
        velocity.x
      );

      const speed = Math.hypot(
        velocity.x,
        velocity.y
      );

      ctx.save();

      ctx.translate(creature.x, creature.y);

      // Soft atmospheric glow.
      const glow = ctx.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        55
      );

      glow.addColorStop(
        0,
        'rgba(0,229,188,0.20)'
      );

      glow.addColorStop(
        0.35,
        'rgba(0,180,255,0.07)'
      );

      glow.addColorStop(
        1,
        'rgba(0,0,0,0)'
      );

      ctx.fillStyle = glow;

      ctx.beginPath();
      ctx.arc(0, 0, 55, 0, Math.PI * 2);
      ctx.fill();

      // Rotate the creature in the direction of travel.
      ctx.rotate(angle);

      const legMotion =
        Math.sin(time * 0.014) *
        Math.min(1, speed * 0.08);

      // Eight cybernetic legs.
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? -1 : 1;
        const row = i % 4;

        const startX = -10 + row * 6;
        const startY = side * 6;

        const reach =
          14 +
          row * 2 +
          legMotion * (i % 2 === 0 ? 1 : -1);

        ctx.strokeStyle =
          'rgba(85,235,255,0.55)';

        ctx.lineWidth = 0.9;
        ctx.lineCap = 'round';

        ctx.beginPath();

        ctx.moveTo(startX, startY);

        ctx.quadraticCurveTo(
          startX + 6,
          side * (12 + row * 2),
          startX + reach,
          side * (18 + row * 3)
        );

        ctx.stroke();

        // Small luminous foot.
        ctx.fillStyle =
          'rgba(0,229,188,0.65)';

        ctx.beginPath();
        ctx.arc(
          startX + reach,
          side * (18 + row * 3),
          1.15,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Main body.
      const body = ctx.createRadialGradient(
        -3,
        -3,
        1,
        0,
        0,
        15
      );

      body.addColorStop(
        0,
        'rgba(235,255,252,1)'
      );

      body.addColorStop(
        0.25,
        'rgba(70,255,225,0.9)'
      );

      body.addColorStop(
        0.7,
        'rgba(0,160,210,0.45)'
      );

      body.addColorStop(
        1,
        'rgba(0,229,188,0)'
      );

      ctx.fillStyle = body;

      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        13,
        9,
        0,
        0,
        Math.PI * 2
      );

      ctx.fill();

      // Small central core.
      ctx.fillStyle =
        'rgba(240,255,255,0.95)';

      ctx.shadowBlur = 14;
      ctx.shadowColor =
        'rgba(0,229,188,0.9)';

      ctx.beginPath();
      ctx.arc(
        2,
        -1,
        3.2 +
          Math.sin(time * 0.01) * 0.5,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.shadowBlur = 0;

      // Two tiny sensor lights.
      ctx.fillStyle =
        'rgba(130,245,255,0.9)';

      ctx.beginPath();
      ctx.arc(7, -4, 1.3, 0, Math.PI * 2);
      ctx.arc(7, 4, 1.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const onPointerMove = (event: PointerEvent) => {
      targetMouseX = event.clientX;
      targetMouseY = event.clientY;
    };

    const update = (dt: number) => {
      if (reducedMotion.matches) return;

      elapsed += dt;

      directionTimer -= dt;
      pauseTimer -= dt;
      webTimer -= dt;

      if (
        directionTimer <= 0 ||
        distance(creature, target) < 80
      ) {
        chooseNewTarget();
      }

      // Smooth cursor influence rather than direct following.
      mouseX +=
        (targetMouseX - mouseX) *
        0.015;

      mouseY +=
        (targetMouseY - mouseY) *
        0.015;

      if (pauseTimer > 0) {
        velocity.x *= 0.94;
        velocity.y *= 0.94;
      } else {
        const dx = target.x - creature.x;
        const dy = target.y - creature.y;

        const length = Math.max(
          1,
          Math.hypot(dx, dy)
        );

        let desiredX = dx / length;
        let desiredY = dy / length;

        // Gentle organic wandering.
        desiredX +=
          Math.sin(elapsed * 0.0007) * 0.32;

        desiredY +=
          Math.cos(elapsed * 0.0009) * 0.32;

        // Very subtle attraction toward the pointer.
        if (width > 700) {
          desiredX +=
            ((mouseX - creature.x) / width) *
            0.12;

          desiredY +=
            ((mouseY - creature.y) / height) *
            0.12;
        }

        const desiredLength = Math.max(
          1,
          Math.hypot(desiredX, desiredY)
        );

        desiredX /= desiredLength;
        desiredY /= desiredLength;

        const acceleration = 0.0022 * dt;

        velocity.x +=
          (desiredX * 0.045 - velocity.x) *
          acceleration;

        velocity.y +=
          (desiredY * 0.045 - velocity.y) *
          acceleration;

        const maxSpeed = 0.16 * dt;

        const currentSpeed = Math.hypot(
          velocity.x,
          velocity.y
        );

        if (currentSpeed > maxSpeed) {
          velocity.x =
            (velocity.x / currentSpeed) *
            maxSpeed;

          velocity.y =
            (velocity.y / currentSpeed) *
            maxSpeed;
        }

        creature.x += velocity.x;
        creature.y += velocity.y;
      }

      // Keep the creature inside the viewport.
      const margin = 35;

      if (creature.x < margin) {
        creature.x = margin;
        velocity.x = Math.abs(velocity.x);
      }

      if (creature.x > width - margin) {
        creature.x = width - margin;
        velocity.x = -Math.abs(velocity.x);
      }

      if (creature.y < margin) {
        creature.y = margin;
        velocity.y = Math.abs(velocity.y);
      }

      if (creature.y > height - margin) {
        creature.y = height - margin;
        velocity.y = -Math.abs(velocity.y);
      }

      // Footprints.
      if (
        Math.hypot(velocity.x, velocity.y) > 0.02 &&
        Math.random() < 0.11
      ) {
        addFootprints();
      }

      for (const footprint of footprints) {
        footprint.age += dt;
      }

      while (
        footprints.length &&
        footprints[0].age > 7000
      ) {
        footprints.shift();
      }

      // Web construction.
      if (
        webTimer <= 0 &&
        pauseTimer > 0
      ) {
        buildWeb();
      }
    };

    const draw = (now: number) => {
      const dt = Math.min(
        40,
        now - lastTime
      );

      lastTime = now;

      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      update(dt);

      drawWebs();
      drawFootprints();
      drawCreature(now);

      animationFrame =
        requestAnimationFrame(draw);
    };

    resize();
    chooseNewTarget();

    window.addEventListener(
      'resize',
      resize,
      { passive: true }
    );

    window.addEventListener(
      'pointermove',
      onPointerMove,
      { passive: true }
    );

    animationFrame =
      requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);

      window.removeEventListener(
        'resize',
        resize
      );

      window.removeEventListener(
        'pointermove',
        onPointerMove
      );
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[20] overflow-hidden"
    />
  );
}
