import {useEffect, useRef} from 'react';
import {Link} from 'react-router';
import {ArrowDown, ArrowRight} from 'lucide-react';
import {
  DUR,
  EASE,
  gsap,
  MOTION_OK,
  ScrollTrigger,
  SplitText,
  STAGGER,
} from '~/lib/motion';
import {displayFontReady} from '~/lib/useMotionOK';
import {stageReady} from '~/lib/stage';
import {HeroCan} from '~/components/home/HeroCan';

export function Hero() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const title = root?.querySelector<HTMLElement>('.hero-title');
    const product = root?.querySelector<HTMLElement>('.hero-product');
    const can = root?.querySelector<HTMLElement>('.hero-can');
    const shadow = root?.querySelector<HTMLElement>('.hero-can-shadow');
    if (!root || !title || !product || !can || !shadow) return;
    const leads = gsap.utils.toArray<HTMLElement>('[data-reveal="lead"]', root);
    const followers = gsap.utils.toArray<HTMLElement>(
      '[data-reveal="follow"]',
      root,
    );

    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, (context) => {
      let cancelled = false;
      // JS owns the reveal from here on: cancels the CSS fallback in theme.css.
      root.dataset.motion = 'on';
      gsap.set([...leads, ...followers, product], {autoAlpha: 0});

      // Split after the font loads, or the char masks are measured on the fallback
      // font; start when the page is revealed (after the preloader or a page wipe).
      // autoSplit re-splits (keeping the animation's progress) if the font lands later.
      void Promise.all([displayFontReady(), stageReady()]).then(() => {
        if (cancelled) return;
        context.add(() => {
          SplitText.create(title, {
            type: 'words,chars',
            mask: 'chars',
            charsClass: 'hero-char',
            autoSplit: true,
            // SplitText's type says void, but a returned animation is what autoSplit
            // reverts and re-syncs; GSAP animations are thenables, hence the rule.
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onSplit(self) {
              gsap.set(title, {autoAlpha: 1});
              const tl = gsap.timeline({delay: 0.1});
              tl.to(
                leads,
                {autoAlpha: 1, y: 0, startAt: {y: 16}, duration: DUR.slow, ease: EASE.out},
                0,
              )
                .from(
                  self.chars,
                  {
                    yPercent: 115,
                    rotate: 8,
                    transformOrigin: '0% 100%',
                    duration: DUR.hero,
                    ease: EASE.expo,
                    stagger: STAGGER.chars,
                  },
                  0.05,
                )
                // Variable-font swell: tween fontWeight, never fontVariationSettings.
                // Snapped to steps of 5: every distinct weight is a new font instance
                // the browser has to build and shape, so fractional values (412.37…)
                // made each frame's layout slow; stepped, the chars share a few dozen.
                .from(
                  self.chars,
                  {
                    fontWeight: 300,
                    snap: {fontWeight: 5},
                    duration: DUR.hero + DUR.base,
                    ease: EASE.out,
                    stagger: STAGGER.chars,
                  },
                  0.05,
                )
                .fromTo(
                  product,
                  {autoAlpha: 0, y: 80, rotate: -18, scale: 0.9},
                  {
                    autoAlpha: 1,
                    y: 0,
                    rotate: 0,
                    scale: 1,
                    duration: DUR.hero,
                    ease: EASE.pop,
                  },
                  0.3,
                )
                .to(
                  followers,
                  {
                    autoAlpha: 1,
                    y: 0,
                    startAt: {y: 28},
                    duration: DUR.slow,
                    ease: EASE.out,
                    stagger: STAGGER.items,
                  },
                  0.75,
                );
              return tl; // lets autoSplit kill and rebuild it at the same progress
            },
          });

          // Idle bob once the can has landed; its shadow breathes in counter-phase.
          const bob = {duration: 2.8, ease: EASE.idle, repeat: -1, yoyo: true, delay: 1.8};
          const loops = [
            gsap.to(can, {y: -14, rotation: 3, ...bob}),
            gsap.to(shadow, {scaleX: 0.84, opacity: 0.5, ...bob}),
          ];
          // Nobody sees the can once the hero has scrolled away: pause the bob.
          ScrollTrigger.create({
            trigger: root,
            start: 'top bottom',
            end: 'bottom top',
            onToggle: (self) => {
              loops.forEach((loop) => {
                loop.paused(!self.isActive);
              });
            },
          });
        });
      });

      return () => {
        cancelled = true;
        delete root.dataset.motion;
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <section className="hero" ref={rootRef} aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="hero-eyebrow" data-reveal="lead">
          Sparkling prebiotic tonic
        </p>
        <h1 className="hero-title" id="hero-title" data-reveal="title">
          <span className="hero-title-line">Sip the</span>{' '}
          <span className="hero-title-line hero-title-accent">sunshine.</span>
        </h1>
        <p className="hero-tagline" data-reveal="follow">
          Real citrus, a kick of ginger and just 5g of sugar. Happy gut, bright
          mood, zero guilt.
        </p>
        <div className="hero-ctas" data-reveal="follow">
          <Link
            className="sf-btn sf-btn--primary"
            to="/collections/all"
            data-magnetic
          >
            Shop the fizz <ArrowRight aria-hidden size={20} />
          </Link>
          <a className="sf-btn sf-btn--ghost" href="#why-it-fizzes">
            Why it fizzes <ArrowDown aria-hidden size={20} />
          </a>
        </div>
      </div>
      <div className="hero-product" data-reveal="product">
        <div className="hero-can">
          <HeroCan />
        </div>
        <div className="hero-can-shadow" aria-hidden="true" />
      </div>
    </section>
  );
}
