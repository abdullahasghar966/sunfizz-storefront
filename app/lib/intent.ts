/**
 * "Load it when someone is actually here": heavy extras (the 3D viewer) wait
 * for the first sign of a person (pointer, touch, key, wheel or scroll) or for
 * the page to have been idle for a while, instead of competing with first
 * paint and hydration. After any interaction in this session (e.g. arriving by
 * clicking a card), they load immediately.
 */
const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;
const OPTIONS = {capture: true, passive: true} as const;

let interacted = false;

if (typeof window !== 'undefined') {
  const mark = () => {
    interacted = true;
    EVENTS.forEach((type) => window.removeEventListener(type, mark, OPTIONS));
  };
  EVENTS.forEach((type) => window.addEventListener(type, mark, OPTIONS));
}

/** Runs `callback` on the first interaction or after `idleMs` of idling; returns a cancel function. */
export function whenIntentOrIdle(callback: () => void, {idleMs = 5000} = {}) {
  if (interacted) {
    callback();
    return () => {};
  }
  let done = false;
  let idleHandle: number | undefined;
  const cleanup = () => {
    EVENTS.forEach((type) => window.removeEventListener(type, run, OPTIONS));
    window.clearTimeout(timer);
    if (idleHandle !== undefined && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(idleHandle);
    }
  };
  const run = () => {
    if (done) return;
    done = true;
    cleanup();
    callback();
  };
  EVENTS.forEach((type) => window.addEventListener(type, run, OPTIONS));
  const timer = window.setTimeout(() => {
    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(run, {timeout: 2000});
    } else {
      run();
    }
  }, idleMs);
  return () => {
    done = true;
    cleanup();
  };
}
