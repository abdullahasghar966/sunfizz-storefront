import {useEffect} from 'react';
import Lenis from 'lenis';
import {gsap, MOTION_OK, ScrollTrigger} from '~/lib/motion';

/**
 * App-wide Lenis smooth scroll, driven by gsap.ticker so Lenis, ScrollTrigger
 * and every tween share one requestAnimationFrame loop. Under
 * prefers-reduced-motion the page keeps plain native scrolling.
 */
export function SmoothScroll() {
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      const lenis = new Lenis({
        lerp: 0.09,
        wheelMultiplier: 0.9,
        autoRaf: false,
        // Pause while the page is overflow-locked (the mobile drawers do that).
        autoToggle: true,
        stopInertiaOnNavigate: true,
        // The cart, search and menu drawers keep native scrolling for their lists.
        prevent: (node) => node.getAttribute?.('role') === 'dialog',
      });

      lenis.on('scroll', ScrollTrigger.update);
      // gsap.ticker passes seconds; lenis.raf expects milliseconds.
      const onTick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);

      // Same-page #links glide to their target. Lenis's own `anchors` option scrolls
      // but doesn't cancel the native jump, so the two fight. Where it lands under
      // the sticky header comes from the target's CSS scroll-margin-top, which both
      // Lenis and the native jump (reduced motion) honour.
      const onClick = (event: MouseEvent) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          !(event.target instanceof Element)
        ) {
          return;
        }
        const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
        const target =
          link && document.getElementById(decodeURIComponent(link.hash.slice(1)));
        if (!target) return;
        event.preventDefault();
        lenis.scrollTo(target, {duration: 1.4});
      };
      document.addEventListener('click', onClick);

      return () => {
        document.removeEventListener('click', onClick);
        gsap.ticker.remove(onTick);
        gsap.ticker.lagSmoothing(500, 33);
        lenis.destroy();
      };
    });

    return () => mm.revert();
  }, []);

  return null;
}
