import type { IndicatorDefinition } from './types';

/**
 * ─── Indicator Registry (Global Intelligence) ─────────────────────────────────
 * Quick indicators for the right column. Fase 0/1 keeps the current visuals;
 * these lazy components are wired in Fase 2. Adding an indicator = registering
 * a lazy component here.
 */
export const indicatorRegistry: {
  getAll: () => IndicatorDefinition[];
  get: (id: string) => IndicatorDefinition | undefined;
} = {
  getAll: () => [
    // Registered structurally; actual widgets are implemented in Fase 2.
  ],
  get: (id: string) => {
    // Placeholder lookup — will be backed by the array when indicators land.
    void id;
    return undefined;
  },
};

