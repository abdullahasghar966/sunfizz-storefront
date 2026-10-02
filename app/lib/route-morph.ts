import {DUR, EASE, gsap, MOTION_OK} from '~/lib/motion';

/**
 * Shared-element route transition (card image → product page hero).
 *
 * 1. On click, `launchMorph` clones the card's image into a fixed "ghost" above
 *    everything, hides the card's own image and fades the old page out. The
 *    link then navigates normally (the loader was prefetched on intent).
 * 2. The new page calls `claimMorph(key)` once it has rendered. If a ghost for
 *    that key is in flight, `landMorph` flies it onto the page's target box
 *    (FLIP with transforms only), reveals the target and removes the ghost.
 *
 * The ghost lives on <body>, outside React, so it survives the route swap.
 * Nothing happens under prefers-reduced-motion: the link just navigates.
 */

type Flight = {
  key: string;
  ghost: HTMLElement;
  source: HTMLElement;
  fadeOut: Element | null;
  timeout: number;
};

let flight: Flight | null = null;

const LIFT_SCALE = 1.04;
const FLY_DURATION = DUR.slow;
const GIVE_UP_AFTER_MS = 5000;

export function launchMorph(
  key: string,
  source: HTMLElement,
  fadeOut: Element | null = null,
) {
  if (!window.matchMedia(MOTION_OK).matches) return;
  const img = source.querySelector('img');
  if (!img) return;
  cancelMorph();

  const rect = source.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'route-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: getComputedStyle(source).borderRadius,
  });
  const clone = document.createElement('img');
  clone.src = img.currentSrc || img.src; // already decoded: no flash
  clone.alt = '';
  ghost.appendChild(clone);
  document.body.appendChild(ghost);

  // The picture lifts off the card while the rest of the page steps back.
  gsap.set(source, {autoAlpha: 0});
  gsap.to(ghost, {scale: LIFT_SCALE, duration: DUR.fast, ease: EASE.out});
  if (fadeOut) {
    gsap.to(fadeOut, {autoAlpha: 0, duration: DUR.fast, ease: EASE.out});
  }

  flight = {
    key,
    ghost,
    source,
    fadeOut,
    // Navigation never landed (error, or the user went somewhere else): undo.
    timeout: window.setTimeout(() => cancelMorph(), GIVE_UP_AFTER_MS),
  };
}

/** Removes any ghost in flight and restores what it hid. */
export function cancelMorph() {
  if (!flight) return;
  const {ghost, source, fadeOut, timeout} = flight;
  flight = null;
  window.clearTimeout(timeout);
  gsap.killTweensOf(ghost);
  gsap.to(ghost, {autoAlpha: 0, duration: DUR.micro, onComplete: () => ghost.remove()});
  if (source.isConnected) gsap.set(source, {autoAlpha: 1});
  if (fadeOut?.isConnected) gsap.to(fadeOut, {autoAlpha: 1, duration: DUR.micro});
}

/** True if a ghost for `key` is waiting to land. Call during the new page's render. */
export function hasMorph(key: string) {
  return flight?.key === key;
}

/** True while any card image is in flight (the page transition then stands aside). */
export function hasMorphInFlight() {
  return flight !== null;
}

/**
 * Flies the waiting ghost onto `target` (which should have the same aspect ratio).
 * `target` is hidden during the flight. Returns false if there was nothing to land.
 */
export function landMorph(
  key: string,
  target: HTMLElement,
  {onLanded}: {onLanded?: () => void} = {},
) {
  if (!flight || flight.key !== key) {
    cancelMorph();
    return false;
  }
  const {ghost, timeout} = flight;
  flight = null;
  window.clearTimeout(timeout);

  gsap.set(target, {autoAlpha: 0});

  // Wait a frame so the new route's scroll reset and layout have happened.
  requestAnimationFrame(() => {
    gsap.killTweensOf(ghost);
    const from = ghost.getBoundingClientRect(); // includes the lift scale
    const to = target.getBoundingClientRect();
    gsap.set(ghost, {
      left: from.left,
      top: from.top,
      width: from.width,
      height: from.height,
      x: 0,
      y: 0,
      scale: 1,
      transformOrigin: '0 0',
    });
    const scale = to.width / from.width;
    const targetRadius = parseFloat(getComputedStyle(target).borderRadius) || 0;

    gsap.to(ghost, {
      x: to.left - from.left,
      y: to.top - from.top,
      scale,
      // Radius is scaled by the transform too; divide so it lands exactly.
      borderRadius: targetRadius / scale,
      duration: FLY_DURATION,
      ease: EASE.inOut,
      onComplete: () => {
        gsap.set(target, {autoAlpha: 1});
        const img = target.querySelector('img');
        const swap = () => {
          gsap.to(ghost, {
            autoAlpha: 0,
            duration: DUR.micro,
            onComplete: () => ghost.remove(),
          });
          onLanded?.();
        };
        // Keep the ghost until the target's own (bigger) image has decoded.
        if (img && !img.complete) {
          const done = () => swap();
          img.addEventListener('load', done, {once: true});
          img.addEventListener('error', done, {once: true});
        } else {
          swap();
        }
      },
    });
  });
  return true;
}
