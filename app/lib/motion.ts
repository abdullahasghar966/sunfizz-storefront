import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {SplitText} from 'gsap/SplitText';
import {ScrambleTextPlugin} from 'gsap/ScrambleTextPlugin';

// The plugins are safe to import during SSR; only register them in the browser.
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);
}

/**
 * Everything that moves is created inside `gsap.matchMedia().add(MOTION_OK, …)`,
 * so it never starts under prefers-reduced-motion and is reverted if the user
 * switches the setting on while the page is open.
 */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

/** Pointer-driven effects (cursor, magnetic, scramble) need a real mouse too. */
export const FINE_POINTER = '(hover: hover) and (pointer: fine)';

/**
 * Motion tokens: the one set of eases, durations and staggers the whole site
 * uses. theme.css mirrors them as --sf-ease-* / --sf-dur-* for CSS transitions.
 */
export const EASE = {
  /** Entrances, reveals, anything settling into place. */
  out: 'power3.out',
  /** Exits: things leaving get out of the way faster. */
  in: 'power3.in',
  /** Travel from A to B (page wipes, the card morph, collapses). */
  inOut: 'power3.inOut',
  /** Big, weighted arrivals (headline characters, the drawer). */
  expo: 'expo.out',
  /** Small playful pops (cursor disc, callouts, numbers). */
  pop: 'back.out(2)',
  /** Springy feedback (button pulses, magnetic release). */
  spring: 'elastic.out(1, 0.4)',
  /** Idle loops. */
  idle: 'sine.inOut',
} as const;

export const DUR = {
  /** Colour, tiny scale. */
  micro: 0.2,
  /** Exits, small moves, fades of secondary things. */
  fast: 0.35,
  /** The default: fades, slides, count-ups. */
  base: 0.6,
  /** Entrances of blocks and cards, page wipes. */
  slow: 0.9,
  /** Headline-scale reveals. */
  hero: 1.2,
} as const;

export const STAGGER = {
  /** Per character (SplitText headlines). */
  chars: 0.04,
  /** Per item (cards, lines, copy blocks). */
  items: 0.08,
} as const;

export {gsap, ScrollTrigger, SplitText, ScrambleTextPlugin};
