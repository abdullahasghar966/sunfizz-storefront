import {useEffect} from 'react';
import {EASE, FINE_POINTER, gsap, MOTION_OK} from '~/lib/motion';

const SELECTOR = '[data-magnetic]';
/** How far beyond an element's edges the pull reaches (px). */
const RADIUS = 80;
/** Default fraction of the pointer's offset the element follows; data-magnetic="0.15" overrides. */
const STRENGTH = 0.35;
const DURATION = 1;

type Item = {
  xTo: gsap.QuickToFunc;
  yTo: gsap.QuickToFunc;
  active: boolean;
};

/**
 * Magnetic pull for primary actions (magnetic-button skill), site-wide and
 * route-proof: any element with data-magnetic (hero CTA, add to cart,
 * checkout, nav links) leans toward a pointer within ~80px of its edges and
 * springs back when it leaves. Wide buttons pass a smaller strength so they
 * don't travel far. Elements are found per frame, so buttons that mount
 * later (drawers, new routes) just work. Mouse + motion only.
 */
export function Magnetic() {
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(`${MOTION_OK} and ${FINE_POINTER}`, () => {
      const items = new Map<HTMLElement, Item>();
      const pointer = {x: -1e5, y: -1e5};
      let dirty = false;

      const itemFor = (el: HTMLElement) => {
        let item = items.get(el);
        if (!item) {
          item = {
            xTo: gsap.quickTo(el, 'x', {duration: DURATION, ease: EASE.spring}),
            yTo: gsap.quickTo(el, 'y', {duration: DURATION, ease: EASE.spring}),
            active: false,
          };
          items.set(el, item);
        }
        return item;
      };

      const update = () => {
        if (!dirty) return;
        dirty = false;
        document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return; // hidden (closed drawer, other breakpoint)
          const item = itemFor(el);
          const strength = Number(el.dataset.magnetic) || STRENGTH;
          // Measure from the resting position: the rect includes our own translate.
          const cx = r.left + r.width / 2 - Number(gsap.getProperty(el, 'x'));
          const cy = r.top + r.height / 2 - Number(gsap.getProperty(el, 'y'));
          const dx = pointer.x - cx;
          const dy = pointer.y - cy;
          // Distance from the element's edge (0 while over it).
          const dist = Math.hypot(
            Math.max(Math.abs(dx) - r.width / 2, 0),
            Math.max(Math.abs(dy) - r.height / 2, 0),
          );
          if (dist < RADIUS) {
            const falloff = 1 - dist / RADIUS; // full pull on the element, none at the field edge
            item.xTo(dx * strength * falloff);
            item.yTo(dy * strength * falloff);
            item.active = true;
          } else if (item.active) {
            item.xTo(0);
            item.yTo(0);
            item.active = false;
          }
        });
        // Forget elements that left the page.
        items.forEach((_item, el) => {
          if (!el.isConnected) items.delete(el);
        });
      };

      const listeners = new AbortController();
      const {signal} = listeners;
      const markDirty = () => {
        dirty = true;
      };
      window.addEventListener(
        'pointermove',
        (event) => {
          pointer.x = event.clientX;
          pointer.y = event.clientY;
          dirty = true;
        },
        {passive: true, signal},
      );
      // The page (or a drawer) can scroll under a still pointer.
      window.addEventListener('scroll', markDirty, {passive: true, capture: true, signal});
      document.documentElement.addEventListener(
        'pointerleave',
        () => {
          pointer.x = pointer.y = -1e5;
          dirty = true;
        },
        {signal},
      );
      gsap.ticker.add(update); // at most one measurement pass per frame

      return () => {
        listeners.abort();
        gsap.ticker.remove(update);
        items.forEach((_item, el) => {
          gsap.killTweensOf(el, 'x,y');
          gsap.set(el, {x: 0, y: 0});
        });
        items.clear();
      };
    });

    return () => mm.revert();
  }, []);

  return null;
}
