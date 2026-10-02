import {useEffect, useRef, type ReactNode} from 'react';
import {DUR, EASE, gsap, MOTION_OK, ScrollTrigger, STAGGER} from '~/lib/motion';
import {stageReady} from '~/lib/stage';

const CARD = '[data-card]';

/**
 * Wraps a product listing and staggers its cards in as they scroll into view
 * (ScrollTrigger.batch, once per card). Cards added later, e.g. by "Load more",
 * are picked up by a MutationObserver. Cards are hidden by the load-reveal CSS
 * until JS takes over; under reduced motion they are simply visible.
 */
export function ProductGrid({
  children,
  className = 'pgrid',
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, (context) => {
      const seen = new WeakSet<Element>();
      let cancelled = false;
      root.dataset.motion = 'on'; // cancels the CSS reveal fallback

      const watch = () => {
        const fresh = gsap.utils
          .toArray<HTMLElement>(CARD, root)
          .filter((card) => !seen.has(card) && !('entered' in card.dataset));
        if (!fresh.length) return;
        fresh.forEach((card) => seen.add(card));

        context.add(() => {
          gsap.set(fresh, {autoAlpha: 0, y: 56});
          ScrollTrigger.batch(fresh, {
            start: 'top 92%',
            once: true,
            onEnter: (batch) => {
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: DUR.slow,
                ease: EASE.out,
                stagger: STAGGER.items,
                overwrite: true,
                onComplete: () => {
                  // Stays visible (CSS) even if this context is reverted later.
                  batch.forEach((card) => {
                    (card as HTMLElement).dataset.entered = '';
                  });
                },
              });
            },
          });
        });
      };

      const observer = new MutationObserver(watch);
      // Cards start staggering in when the page is revealed (preloader / page wipe).
      void stageReady().then(() => {
        if (cancelled) return;
        watch();
        observer.observe(root, {childList: true, subtree: true});
      });

      return () => {
        cancelled = true;
        observer.disconnect();
        delete root.dataset.motion;
      };
    });

    // Touch screens have no hover: a card pours its second image while it sits
    // in the middle of the screen, and goes back to the can as you scroll on.
    mm.add(`${MOTION_OK} and (hover: none)`, () => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            entry.target.classList.toggle('is-poured', entry.isIntersecting);
          });
        },
        {rootMargin: '-30% 0px -30% 0px', threshold: 0.6},
      );
      const watchCards = () => {
        root.querySelectorAll('[data-card]:has(.has-alt)').forEach((card) => observer.observe(card));
      };
      watchCards();
      const mutations = new MutationObserver(watchCards);
      mutations.observe(root, {childList: true, subtree: true});
      return () => {
        observer.disconnect();
        mutations.disconnect();
        root.querySelectorAll('.is-poured').forEach((card) => card.classList.remove('is-poured'));
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <div className={className} ref={rootRef}>
      {children}
    </div>
  );
}
