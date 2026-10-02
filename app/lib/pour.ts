import {DUR, gsap} from '~/lib/motion';

/**
 * Drives "the pour" (components/motion/PourOverlay): a full-screen liquid panel
 * that rises to cover the page and keeps rising to reveal the next one. Used by
 * the preloader (fill → reveal), page transitions (cover → reveal) and the
 * checkout handoff (cover and stay).
 *
 * Positions are yPercent of the viewport-high panel: 112 = parked below (its
 * top wave hidden too), 0 = covering, -112 = gone above.
 */
const BELOW = 112;
const ABOVE = -112;

/** Cover and reveal ease so they join into one continuous rise when there's no wait. */
const COVER = {duration: DUR.fast + 0.1, ease: 'power2.in'};
const REVEAL = {duration: DUR.base + 0.1, ease: 'power2.out'};

let tl: gsap.core.Timeline | null = null;

function parts() {
  const root = document.querySelector<HTMLElement>('.pour');
  const liquid = root?.querySelector<HTMLElement>('.pour-liquid');
  if (!root || !liquid) return null;
  return {
    root,
    liquid,
    label: root.querySelector<HTMLElement>('.pour-label'),
    sub: root.querySelector<HTMLElement>('.pour-sub'),
  };
}

/** Take over from the CSS pre-fill animation without a jump. */
function adopt(liquid: HTMLElement) {
  if (liquid.dataset.gsap) return;
  const matrix = new DOMMatrix(getComputedStyle(liquid).transform);
  const fromPercent = (matrix.m42 / (liquid.offsetHeight || 1)) * 100;
  liquid.style.animation = 'none';
  liquid.dataset.gsap = 'on';
  gsap.set(liquid, {y: 0, yPercent: Number.isFinite(fromPercent) ? fromPercent : BELOW});
}

function setText(el: HTMLElement | null | undefined, text: string | undefined) {
  if (el && text !== undefined) el.textContent = text;
}

/** Raise the liquid until it covers the screen. Resolves when covered. */
export function pourCover({
  label,
  sub,
  showCenter = false,
}: {label?: string; sub?: string; showCenter?: boolean} = {}) {
  const p = parts();
  if (!p) return Promise.resolve();
  adopt(p.liquid);
  tl?.kill();
  setText(p.label, label ?? 'Pouring…');
  setText(p.sub, sub ?? '');
  p.root.classList.add('is-active');
  p.root.classList.toggle('show-center', showCenter);
  return new Promise<void>((resolve) => {
    const from = Number(gsap.getProperty(p.liquid, 'yPercent'));
    tl = gsap.timeline({onComplete: resolve}).fromTo(
      p.liquid,
      {yPercent: from > 0 ? from : BELOW},
      {yPercent: 0, ...COVER},
    );
  });
}

/** Show the wordmark + label while covered (e.g. a slow page load). */
export function pourShowCenter() {
  parts()?.root.classList.add('show-center');
}

/** Keep rising until the page underneath is fully revealed. */
export function pourReveal() {
  const p = parts();
  if (!p) return Promise.resolve();
  adopt(p.liquid);
  tl?.kill();
  p.root.classList.remove('show-center');
  // Visible for the whole rise (the preloader has just dropped html.is-preloading).
  p.root.classList.add('is-active');
  return new Promise<void>((resolve) => {
    tl = gsap.timeline({
      onComplete: () => {
        p.root.classList.remove('is-active');
        gsap.set(p.liquid, {yPercent: BELOW});
        resolve();
      },
    }).to(p.liquid, {yPercent: ABOVE, ...REVEAL});
  });
}

/** Preloader: set the liquid level (0 = empty, 1 = full screen). */
export function pourFill(level: number, duration: number = DUR.base) {
  const p = parts();
  if (!p) return Promise.resolve();
  adopt(p.liquid);
  tl?.kill();
  p.root.classList.add('is-active');
  return new Promise<void>((resolve) => {
    tl = gsap.timeline({onComplete: resolve}).to(p.liquid, {
      yPercent: 100 * (1 - Math.min(1, Math.max(0, level))),
      duration,
      ease: 'power2.out',
    });
  });
}

/** Put everything away instantly (reduced motion, back/forward cache restore). */
export function pourReset() {
  const p = parts();
  if (!p) return;
  tl?.kill();
  tl = null;
  p.root.classList.remove('is-active', 'show-center');
  p.liquid.style.animation = 'none';
  p.liquid.dataset.gsap = 'on';
  gsap.set(p.liquid, {y: 0, yPercent: BELOW});
}
