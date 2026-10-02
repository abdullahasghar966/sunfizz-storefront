import {useEffect} from 'react';
import {FINE_POINTER, gsap, MOTION_OK} from '~/lib/motion';

const DURATION = 0.7;

/**
 * ScrambleText on hover (scramble-text-hover skill), delegated so it works for
 * any link rendered anywhere: hovering an element that contains
 * [data-scramble] decodes that span back into its data-text. The visible span
 * is aria-hidden next to a screen-reader copy, its width is frozen during the
 * scramble so the nav doesn't wobble, and a running scramble isn't restarted
 * by hover jitter. Mouse + motion only.
 */
export function Scramble() {
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(`${MOTION_OK} and ${FINE_POINTER}`, () => {
      const running = new WeakMap<Element, gsap.core.Tween>();

      const onOver = (event: PointerEvent) => {
        const host = (event.target as Element | null)?.closest?.('a, button');
        const span = host?.querySelector<HTMLElement>('[data-scramble]');
        if (!span) return;
        // Only when the pointer arrives from outside the host, and not mid-scramble.
        const from = event.relatedTarget as Node | null;
        if (from && host?.contains(from)) return;
        if (running.get(span)?.isActive()) return;
        const text = span.dataset.text ?? span.textContent ?? '';
        span.style.width = `${span.getBoundingClientRect().width}px`;
        running.set(
          span,
          gsap.to(span, {
            duration: DURATION,
            ease: 'none',
            scrambleText: {
              text,
              chars: 'lowerCase',
              revealDelay: 0.15,
              speed: 0.6,
              oldClass: 'is-scrambled',
            },
            onComplete: () => {
              span.style.width = '';
            },
          }),
        );
      };

      document.addEventListener('pointerover', onOver);
      return () => {
        document.removeEventListener('pointerover', onOver);
        document.querySelectorAll<HTMLElement>('[data-scramble]').forEach((span) => {
          gsap.killTweensOf(span);
          span.style.width = '';
          if (span.dataset.text) span.textContent = span.dataset.text;
        });
      };
    });

    return () => mm.revert();
  }, []);

  return null;
}
