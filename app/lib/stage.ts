/**
 * The "stage gate": entrance animations (hero headline, page titles, card
 * staggers) wait for it, so they play when the page is actually revealed
 * instead of behind the preloader or a page-transition wipe.
 *
 * - First load with the preloader: closed until the preloader starts lifting.
 * - Route change: closed while the wipe covers the screen, opened as it lifts.
 * - Everything else: open (resolves immediately).
 */
let gate: Promise<void> = Promise.resolve();
let release: (() => void) | null = null;

if (
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('is-preloading')
) {
  closeStage();
}

export function closeStage() {
  if (release) return;
  gate = new Promise<void>((resolve) => {
    release = resolve;
  });
}

export function openStage() {
  const done = release;
  release = null;
  done?.();
}

export function isStageOpen() {
  return release === null;
}

/** Resolves when the page is on stage (immediately if it already is). */
export function stageReady() {
  return gate;
}
