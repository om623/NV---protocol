// Camera framing for the Nvult scene. Pure maths (no WebGL), so the rule itself is unit-tested.

export const FOV = 28;

/**
 * Measured on every vertex of the character over six worst-case looks and six turntable angles: the Data Lance tip is the
 * highest point of any equipment, and at the previous framing it left the 4:5 stage by ~1.2%.
 * Lifting the camera 0.08 m and pulling it back 3% leaves ~3.2% of headroom while the pedestal's top disc stays in view.
 */
export const FRAME_ZOOM = 1.03;
export const FRAME_LIFT = 0.08;

export interface Framing {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

/** Frame the whole figure (wings and weapon included) whatever the container shape is. */
export function frameFor(aspect: number): Framing {
  const t = Math.tan((FOV * Math.PI) / 360);
  const dist = Math.max(1.2 / (t * aspect), 1.2 / t) * 1.02 * FRAME_ZOOM;
  return { position: [0, 1.02 + FRAME_LIFT, dist], target: [0, 1.1 + FRAME_LIFT, 0] };
}
