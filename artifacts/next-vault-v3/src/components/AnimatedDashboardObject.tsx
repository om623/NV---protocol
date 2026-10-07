import { useEffect, useRef } from "react";

type Vec = {
  x: number;
  y: number;
};

type Footprint = {
  x: number;
  y: number;
  rotation: number;
  life: number;
  side: number;
};

type WebPoint = {
  x: number;
  y: number;
  born: number;
};

type Web = {
  center: Vec;
  points: WebPoint[];
  born: number;
  progress: number;
  life: number;
};

export function AnimatedDashboardObject() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;

    const ctxRaw = canvasRaw.getContext("2d");
    if (!ctxRaw) return;

    // Alias as non-null for inner function closures
    const canvas = canvasRaw!;
    const ctx = ctxRaw!;



    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    let raf = 0;
    let previous = performance.now();

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    /*
     * ============================================================
     * WORLD
     * ============================================================
     */

    const creature: Vec = {
      x: width * 0.5,
      y: height * 0.45,
    };

    const velocity: Vec = {
      x: 0,
      y: 0,
    };

    const target: Vec = {
      x: width * 0.75,
      y: height * 0.35,
    };

    const mouse: Vec = {
      x: width / 2,
      y: height / 2,
    };

    const desiredMouse: Vec = {
      x: width / 2,
      y: height / 2,
    };

    const footprints: Footprint[] = [];
    const webs: Web[] = [];

    let elapsed = 0;
    let targetAge = 0;
    let targetDuration = 0;

    let restTime = 0;
    let footprintClock = 0;
    let webClock = 0;

    let walking = true;

    /*
     * ============================================================
     * RESIZE
     * ============================================================
     */

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;

      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      creature.x = Math.max(
        40,
        Math.min(width - 40, creature.x)
      );

      creature.y = Math.max(
        40,
        Math.min(height - 40, creature.y)
      );
    }

    /*
     * ============================================================
     * NEW DESTINATION
     *
     * IMPORTANT:
     * This is what makes the creature actually TRAVEL.
     * ============================================================
     */

    function chooseDestination() {
      const margin = 55;

      target.x =
        margin +
        Math.random() *
          Math.max(10, width - margin * 2);

      target.y =
        margin +
        Math.random() *
          Math.max(10, height - margin * 2);

      targetAge = 0;

      targetDuration =
        3500 +
        Math.random() * 7000;

      walking = true;

      /*
       * Occasionally stop at the destination.
       */
      if (Math.random() < 0.24) {
        restTime =
          800 +
          Math.random() * 2200;
      }
    }

    /*
     * ============================================================
     * DISTANCE
     * ============================================================
     */

    function distance(a: Vec, b: Vec) {
      return Math.hypot(
        b.x - a.x,
        b.y - a.y
      );
    }

    /*
     * ============================================================
     * FOOTPRINTS
     * ============================================================
     */

    function createFootprint(
      rotation: number,
      side: number
    ) {
      footprints.push({
        x: creature.x,
        y: creature.y,
        rotation,
        life: 0,
        side,
      });

      if (footprints.length > 130) {
        footprints.shift();
      }
    }

    /*
     * ============================================================
     * CREATE WEB
     * ============================================================
     */

    function createWeb() {
      const web: Web = {
        center: {
          x: creature.x,
          y: creature.y,
        },
        points: [],
        born: elapsed,
        progress: 0,
        life: 0,
      };

      /*
       * Irregular web nodes.
       */
      const rings = 4;
      const nodesPerRing = 7;

      for (let ring = 1; ring <= rings; ring++) {
        const radius =
          25 +
          ring * 18 +
          Math.random() * 14;

        for (
          let i = 0;
          i < nodesPerRing;
          i++
        ) {
          const angle =
            (i / nodesPerRing) *
              Math.PI *
              2 +
            ring * 0.35;

          web.points.push({
            x:
              web.center.x +
              Math.cos(angle) *
                radius *
                (0.8 + Math.random() * 0.4),

            y:
              web.center.y +
              Math.sin(angle) *
                radius *
                (0.8 + Math.random() * 0.4),

            born: elapsed,
          });
        }
      }

      webs.push(web);

      /*
       * Keep the screen clean.
       */
      if (webs.length > 5) {
        webs.shift();
      }
    }

    /*
     * ============================================================
     * MOUSE
     * ============================================================
     */

    function pointerMove(
      event: PointerEvent
    ) {
      desiredMouse.x = event.clientX;
      desiredMouse.y = event.clientY;
    }

    /*
     * ============================================================
     * UPDATE CREATURE
     * ============================================================
     */

    function update(dt: number) {
      if (reducedMotion.matches) {
        return;
      }

      elapsed += dt;
      targetAge += dt;
      footprintClock += dt;
      webClock += dt;

      /*
       * Smooth mouse.
       */
      mouse.x +=
        (desiredMouse.x - mouse.x) *
        0.025;

      mouse.y +=
        (desiredMouse.y - mouse.y) *
        0.025;

      /*
       * ----------------------------------------------------------
       * REST
       * ----------------------------------------------------------
       */

      if (restTime > 0) {
        restTime -= dt;

        velocity.x *= 0.92;
        velocity.y *= 0.92;

        if (restTime <= 0) {
          chooseDestination();
        }

        return;
      }

      /*
       * ----------------------------------------------------------
       * DESTINATION REACHED
       * ----------------------------------------------------------
       */

      const distanceToTarget =
        distance(creature, target);

      if (
        distanceToTarget < 45 ||
        targetAge > targetDuration
      ) {
        chooseDestination();
      }

      /*
       * ----------------------------------------------------------
       * DIRECTION
       * ----------------------------------------------------------
       */

      const dx =
        target.x - creature.x;

      const dy =
        target.y - creature.y;

      const targetDistance =
        Math.max(
          1,
          Math.hypot(dx, dy)
        );

      let directionX =
        dx / targetDistance;

      let directionY =
        dy / targetDistance;

      /*
       * Organic wandering.
       *
       * This is deliberately NOT circular.
       */
      const wanderStrength = 0.45;

      directionX +=
        Math.sin(elapsed * 0.0011) *
        wanderStrength;

      directionY +=
        Math.cos(elapsed * 0.0008) *
        wanderStrength;

      /*
       * Very subtle attraction to mouse.
       */
      if (width > 700) {
        directionX +=
          ((mouse.x - creature.x) / width) *
          0.08;

        directionY +=
          ((mouse.y - creature.y) / height) *
          0.08;
      }

      const directionLength =
        Math.max(
          1,
          Math.hypot(
            directionX,
            directionY
          )
        );

      directionX /= directionLength;
      directionY /= directionLength;

      /*
       * ----------------------------------------------------------
       * REAL ACCELERATION
       * ----------------------------------------------------------
       */

      const acceleration = 0.00075 * dt;

      velocity.x +=
        directionX *
        acceleration;

      velocity.y +=
        directionY *
        acceleration;

      /*
       * Maximum travel speed.
       */
      const maxSpeed = 0.24;

      const speed =
        Math.hypot(
          velocity.x,
          velocity.y
        );

      if (speed > maxSpeed) {
        velocity.x =
          (velocity.x / speed) *
          maxSpeed;

        velocity.y =
          (velocity.y / speed) *
          maxSpeed;
      }

      /*
       * ----------------------------------------------------------
       * MOVE THROUGH THE SCREEN
       * ----------------------------------------------------------
       */

      creature.x +=
        velocity.x * dt;

      creature.y +=
        velocity.y * dt;

      /*
       * ----------------------------------------------------------
       * SCREEN BOUNDARIES
       *
       * It doesn't teleport.
       * It turns around.
       * ----------------------------------------------------------
       */

      const margin = 28;

      if (creature.x < margin) {
        creature.x = margin;
        velocity.x =
          Math.abs(velocity.x) + 0.01;
      }

      if (creature.x > width - margin) {
        creature.x = width - margin;
        velocity.x =
          -Math.abs(velocity.x) - 0.01;
      }

      if (creature.y < margin) {
        creature.y = margin;
        velocity.y =
          Math.abs(velocity.y) + 0.01;
      }

      if (creature.y > height - margin) {
        creature.y = height - margin;
        velocity.y =
          -Math.abs(velocity.y) - 0.01;
      }

      /*
       * ----------------------------------------------------------
       * FOOTPRINTS
       * ----------------------------------------------------------
       */

      const currentSpeed =
        Math.hypot(
          velocity.x,
          velocity.y
        );

      if (
        currentSpeed > 0.035 &&
        footprintClock > 95
      ) {
        footprintClock = 0;

        const angle =
          Math.atan2(
            velocity.y,
            velocity.x
          );

        createFootprint(
          angle,
          Math.random() > 0.5 ? 1 : -1
        );
      }

      /*
       * Age footprints.
       */
      for (const footprint of footprints) {
        footprint.life += dt;
      }

      /*
       * ----------------------------------------------------------
       * WEB CREATION
       * ----------------------------------------------------------
       *
       * After enough exploration the creature
       * periodically creates a web.
       * ----------------------------------------------------------
       */

      if (
        webClock > 12500 &&
        currentSpeed < 0.08
      ) {
        webClock = 0;
        createWeb();
      }
    }

    /*
     * ============================================================
     * DRAW FOOTPRINTS
     * ============================================================
     */

    function drawFootprints() {
      ctx.save();

      for (const footprint of footprints) {
        const life =
          1 -
          footprint.life / 8500;

        if (life <= 0) continue;

        ctx.save();

        ctx.translate(
          footprint.x,
          footprint.y
        );

        ctx.rotate(
          footprint.rotation
        );

        const side =
          footprint.side;

        ctx.strokeStyle =
          `rgba(0,229,188,${0.18 * life})`;

        ctx.lineWidth = 0.7;

        /*
         * Three tiny digital claw marks.
         */
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();

          ctx.moveTo(
            side * 2,
            i * 3
          );

          ctx.lineTo(
            side * 8,
            i * 5
          );

          ctx.stroke();
        }

        ctx.restore();
      }

      ctx.restore();
    }

    /*
     * ============================================================
     * DRAW WEBS
     * ============================================================
     */

    function drawWebs() {
      ctx.save();

      for (const web of webs) {
        web.life += 16;

        /*
         * Web gradually appears.
         */
        web.progress = Math.min(
          1,
          (elapsed - web.born) /
            7000
        );

        /*
         * Web gradually disappears after a while.
         */
        const lifetime =
          elapsed - web.born;

        let opacity = 1;

        if (lifetime > 26000) {
          opacity =
            Math.max(
              0,
              1 -
                (lifetime - 26000) /
                  5000
            );
        }

        /*
         * Radial cybernetic threads.
         */
        const visiblePoints =
          Math.floor(
            web.points.length *
              web.progress
          );

        for (
          let i = 0;
          i < visiblePoints;
          i++
        ) {
          const point =
            web.points[i];

          ctx.strokeStyle =
            `rgba(0,229,188,${0.16 * opacity})`;

          ctx.lineWidth = 0.65;

          ctx.beginPath();

          ctx.moveTo(
            web.center.x,
            web.center.y
          );

          ctx.lineTo(
            point.x,
            point.y
          );

          ctx.stroke();
        }

        /*
         * Circular / polygonal threads.
         */
        for (
          let ring = 0;
          ring < 3;
          ring++
        ) {
          const radius =
            35 + ring * 25;

          ctx.beginPath();

          for (
            let i = 0;
            i <= 14;
            i++
          ) {
            const angle =
              (i / 14) *
                Math.PI *
                2;

            const wobble =
              Math.sin(
                i * 2.7 + ring
              ) * 4;

            const x =
              web.center.x +
              Math.cos(angle) *
                (radius + wobble);

            const y =
              web.center.y +
              Math.sin(angle) *
                (radius + wobble);

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          ctx.strokeStyle =
            `rgba(70,210,255,${0.12 * opacity * web.progress})`;

          ctx.lineWidth = 0.55;

          ctx.stroke();
        }

        /*
         * Glowing nodes.
         */
        for (
          let i = 0;
          i < visiblePoints;
          i++
        ) {
          const point =
            web.points[i];

          ctx.fillStyle =
            `rgba(0,229,188,${0.35 * opacity})`;

          ctx.shadowBlur = 8;

          ctx.shadowColor =
            "rgba(0,229,188,0.8)";

          ctx.beginPath();

          ctx.arc(
            point.x,
            point.y,
            1.3,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;

      ctx.restore();
    }

    /*
     * ============================================================
     * DRAW CREATURE
     * ============================================================
     */

    function drawCreature(
      now: number
    ) {
      const speed =
        Math.hypot(
          velocity.x,
          velocity.y
        );

      const angle =
        Math.atan2(
          velocity.y,
          velocity.x
        );

      /*
       * Leg animation is based on ACTUAL movement.
       */
      const walkCycle =
        now *
        0.018 *
        Math.max(
          0.4,
          speed * 12
        );

      ctx.save();

      ctx.translate(
        creature.x,
        creature.y
      );

      ctx.rotate(angle);

      /*
       * ----------------------------------------------------------
       * AURA
       * ----------------------------------------------------------
       */

      const aura =
        ctx.createRadialGradient(
          0,
          0,
          0,
          0,
          0,
          58
        );

      aura.addColorStop(
        0,
        "rgba(0,229,188,0.18)"
      );

      aura.addColorStop(
        0.35,
        "rgba(0,180,255,0.08)"
      );

      aura.addColorStop(
        1,
        "rgba(0,0,0,0)"
      );

      ctx.fillStyle = aura;

      ctx.beginPath();

      ctx.arc(
        0,
        0,
        58,
        0,
        Math.PI * 2
      );

      ctx.fill();

      /*
       * ----------------------------------------------------------
       * LEGS
       * ----------------------------------------------------------
       */

      for (let i = 0; i < 8; i++) {
        const side =
          i < 4 ? -1 : 1;

        const row = i % 4;

        const x =
          -11 + row * 7;

        const y =
          side * 5;

        /*
         * Alternating walking gait.
         */
        const gait =
          Math.sin(
            walkCycle +
              row * 0.9 +
              (side > 0 ? Math.PI : 0)
          ) * 4;

        const footX =
          x +
          18 +
          row * 2;

        const footY =
          side *
          (17 +
            row * 4 +
            gait);

        ctx.strokeStyle =
          "rgba(70,230,255,0.7)";

        ctx.lineWidth = 1;

        ctx.lineCap = "round";

        ctx.beginPath();

        ctx.moveTo(x, y);

        ctx.lineTo(
          x + 8,
          y + side * 8
        );

        ctx.lineTo(
          footX,
          footY
        );

        ctx.stroke();

        /*
         * Foot glow.
         */
        ctx.fillStyle =
          "rgba(0,229,188,0.75)";

        ctx.beginPath();

        ctx.arc(
          footX,
          footY,
          1.25,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }

      /*
       * ----------------------------------------------------------
       * BODY
       * ----------------------------------------------------------
       */

      const body =
        ctx.createRadialGradient(
          -3,
          -3,
          1,
          0,
          0,
          16
        );

      body.addColorStop(
        0,
        "rgba(255,255,255,1)"
      );

      body.addColorStop(
        0.22,
        "rgba(90,255,230,1)"
      );

      body.addColorStop(
        0.55,
        "rgba(0,205,190,0.75)"
      );

      body.addColorStop(
        1,
        "rgba(0,100,180,0)"
      );

      ctx.fillStyle = body;

      ctx.shadowBlur = 18;

      ctx.shadowColor =
        "rgba(0,229,188,0.9)";

      ctx.beginPath();

      ctx.ellipse(
        0,
        0,
        14,
        9,
        0,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.shadowBlur = 0;

      /*
       * ----------------------------------------------------------
       * CORE
       * ----------------------------------------------------------
       */

      ctx.fillStyle =
        "rgba(240,255,255,0.98)";

      ctx.beginPath();

      ctx.arc(
        3,
        0,
        3.5 +
          Math.sin(now * 0.008) * 0.6,
        0,
        Math.PI * 2
      );

      ctx.fill();

      /*
       * ----------------------------------------------------------
       * SENSOR LIGHTS
       * ----------------------------------------------------------
       */

      ctx.fillStyle =
        "rgba(120,245,255,0.95)";

      ctx.beginPath();

      ctx.arc(
        8,
        -4,
        1.4,
        0,
        Math.PI * 2
      );

      ctx.arc(
        8,
        4,
        1.4,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();
    }

    /*
     * ============================================================
     * MAIN LOOP
     * ============================================================
     */

    function frame(now: number) {
      const dt = Math.min(
        32,
        now - previous
      );

      previous = now;

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

      raf =
        requestAnimationFrame(frame);
    }

    /*
     * ============================================================
     * START
     * ============================================================
     */

    resize();

    chooseDestination();

    window.addEventListener(
      "resize",
      resize
    );

    window.addEventListener(
      "pointermove",
      pointerMove,
      { passive: true }
    );

    raf =
      requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);

      window.removeEventListener(
        "resize",
        resize
      );

      window.removeEventListener(
        "pointermove",
        pointerMove
      );
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[20]"
    />
  );
}
