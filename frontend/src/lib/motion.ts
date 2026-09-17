import type { Transition, Variants } from "framer-motion";

/**
 * Shared animation language for the whole app.
 *
 * Why this exists: previously each component hand-rolled its own `duration`,
 * `ease` and `delay`, so entrances felt slightly different from screen to
 * screen. Centralising the tokens guarantees one consistent feel everywhere,
 * and keeps GPU-friendly properties (opacity / transform only) front and centre.
 *
 * All easings are cubic-bezier curves:
 *  - EASE        : "expo-out" — fast off the mark, gentle settle. Best for
 *                  entrances because it feels responsive without being abrupt.
 *  - EASE_IN_OUT : symmetric — for state changes (expand/collapse, toggles).
 */
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const DURATION = {
  fast: 0.2,
  base: 0.35,
  slow: 0.5,
} as const;

/** Seconds between sibling items in a staggered reveal. Small = snappy. */
export const STAGGER = 0.05;

/** Reusable variants (pure state — no per-variant transition so callers can
 *  supply their own `transition` prop, e.g. to add a stagger `delay`). */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
};

/** Wrap a group of items so they cascade in. Used by containers that animate
 *  on mount / in-view; children inherit `hidden`/`visible` and get the delay. */
export const staggerContainer = (stagger = STAGGER, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

/** Default transition for a one-off entrance. */
export const entrance: Transition = { duration: DURATION.base, ease: EASE };
