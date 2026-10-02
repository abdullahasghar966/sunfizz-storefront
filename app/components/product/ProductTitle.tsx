import {useEffect, useRef} from 'react';
import {DUR, EASE, gsap, MOTION_OK, SplitText, STAGGER} from '~/lib/motion';
import {displayFontReady} from '~/lib/useMotionOK';
import {stageReady} from '~/lib/stage';

/**
 * Product page headline: masked per-character rise with a variable-font weight
 * swell (splittext-staggered-reveal skill, scaled down from the homepage hero).
 * Re-runs when the product changes. Hidden by the load-reveal CSS until split
 * (the page root sets data-motion); plain text under reduced motion.
 */
export function ProductTitle({children}: {children: string}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const title = ref.current;
    if (!title) return;
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, (context) => {
      let cancelled = false;
      gsap.set(title, {autoAlpha: 0});

      void Promise.all([displayFontReady(), stageReady()]).then(() => {
        if (cancelled) return;
        context.add(() => {
          SplitText.create(title, {
            type: 'words,chars',
            mask: 'chars',
            charsClass: 'pdp-char',
            autoSplit: true,
            // Returning the animation lets autoSplit rebuild it at the same progress
            // after a re-split. GSAP animations are thenables, hence the rule.
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onSplit(self) {
              gsap.set(title, {autoAlpha: 1});
              return gsap
                .timeline({delay: 0.15})
                .from(
                  self.chars,
                  {
                    yPercent: 115,
                    rotate: 6,
                    transformOrigin: '0% 100%',
                    duration: DUR.hero,
                    ease: EASE.expo,
                    stagger: STAGGER.chars,
                  },
                  0,
                )
                .from(
                  self.chars,
                  {
                    fontWeight: 300,
                    // Whole steps of 5 so the chars share cached font instances (see Hero).
                    snap: {fontWeight: 5},
                    duration: DUR.hero + DUR.base,
                    ease: EASE.out,
                    stagger: STAGGER.chars,
                  },
                  0,
                );
            },
          });
        });
      });

      return () => {
        cancelled = true;
      };
    });

    return () => mm.revert();
  }, [children]);

  return (
    // The key remounts the heading per product, so SplitText never sees stale chars.
    <h1 className="pdp-title" data-reveal="title" ref={ref} key={children}>
      {children}
    </h1>
  );
}
