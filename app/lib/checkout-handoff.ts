import {EASE, gsap, MOTION_OK} from '~/lib/motion';
import {pourCover, pourReset} from '~/lib/pour';

/**
 * The moment of leaving for Shopify's hosted checkout: a quick pulse on the
 * button, then the site's own page transition (the pour) rises with
 * "Pouring your order…" and stays up while the browser loads the checkout.
 * Navigation starts as soon as the liquid covers the screen (~0.45s), so the
 * animation hides network time instead of adding to it.
 *
 * Reduced motion: navigate immediately. Back/forward cache: if the shopper
 * comes back with the browser's Back button, the overlay is put away.
 */
export function pourToCheckout(
  url: string,
  {button, onReturn}: {button?: HTMLElement | null; onReturn?: () => void} = {},
) {
  if (!window.matchMedia(MOTION_OK).matches) {
    window.location.assign(url);
    return;
  }

  if (button) {
    gsap
      .timeline()
      .to(button, {scale: 0.95, duration: 0.1, ease: 'power2.out'})
      .to(button, {scale: 1, duration: 0.6, ease: EASE.spring});
  }

  void pourCover({
    label: 'Pouring your order…',
    sub: 'Taking you to Shopify’s secure checkout',
    showCenter: true,
  }).then(() => {
    window.location.assign(url);
  });

  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    // Restored from the back/forward cache with the liquid still up: tidy away.
    window.removeEventListener('pageshow', onPageShow);
    pourReset();
    if (button) gsap.set(button, {clearProps: 'scale'});
    onReturn?.();
  };
  window.addEventListener('pageshow', onPageShow);
}
