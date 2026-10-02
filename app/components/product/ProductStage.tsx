import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {Image} from '@shopify/hydrogen';
import {Citrus, Flower2, Leaf, Sprout} from 'lucide-react';
import {DUR, EASE, gsap, MOTION_OK, ScrollTrigger, STAGGER} from '~/lib/motion';
import {stageReady} from '~/lib/stage';
import {whenIntentOrIdle} from '~/lib/intent';
import {useMotionOK} from '~/lib/useMotionOK';
import {hasMorph, landMorph} from '~/lib/route-morph';
import type {Flavour, Ingredient} from '~/lib/flavours';
import type {ProductQuery} from 'storefrontapi.generated';

// three.js + React Three Fiber only load on product pages, after hydration.
const CanViewer = lazy(() => import('~/components/product/CanViewer'));

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

type StageImage = NonNullable<ProductQuery['product']>['featuredImage'];

const INGREDIENT_ICON = {
  citrus: Citrus,
  flower: Flower2,
  leaf: Leaf,
  botanical: Sprout,
} as const;

// Callout spots around the can, as % of the stage. Right-hand pills are anchored
// by their right edge so a long name can't run off a narrow stage.
const CALLOUT_SPOTS: Array<{left?: number; right?: number; top: number}> = [
  {left: 6, top: 18},
  {right: 6, top: 32},
  {left: 8, top: 64},
  {right: 8, top: 74},
];

/** Can dimensions relative to the square packshot, so the 3D can lands where the photo's can was. */
const CAN_HEIGHT_IN_SHOT = 0.7;
const CAN_CENTRE_IN_SHOT = 0.545;

/**
 * Left column of the product page: the packshot first (server-rendered, and
 * the landing spot of the card → page morph), then the 3D can fades in over
 * it once three.js has loaded and the label is drawn. Ingredient callouts
 * float around it.
 */
export function ProductStage({
  handle,
  productTitle,
  image,
  flavours,
  ingredients,
}: {
  handle: string;
  productTitle: string;
  image: StageImage;
  /** Cans to show: one flavour, or the four of the variety pack. Empty = packshot only. */
  flavours: Flavour[];
  ingredients: Ingredient[];
}) {
  const motion = useMotionOK();
  const stageRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  // three.js (~230 KB gzipped) loads on the visitor's first interaction or when
  // the page has been idle a while, never in the way of first paint/hydration.
  const [load3D, setLoad3D] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // False while a card image is flying in (client navigation from the listing).
  const [landed, setLanded] = useState(() => !hasMorph(handle));
  const [revealed, setRevealed] = useState(false);
  const [fit, setFit] = useState({canHeightPx: 0, offsetYPx: 0});

  const hasCans = flavours.length > 0;
  useEffect(() => {
    setMounted(true);
    if (!hasCans || !('WebGL2RenderingContext' in window)) return;
    return whenIntentOrIdle(() => setLoad3D(true));
  }, [hasCans]);

  // First paint of this page: land the card → page morph on the packshot box if
  // one is in flight, otherwise bring the packshot in on its own.
  const arrivedRef = useRef(false);
  useIsomorphicLayoutEffect(() => {
    const media = mediaRef.current;
    if (arrivedRef.current || !media) return; // not again on flavour switches
    arrivedRef.current = true;
    if (landMorph(handle, media, {onLanded: () => setLanded(true)})) return;
    setLanded(true);
    if (window.matchMedia(MOTION_OK).matches) {
      gsap.set(media, {autoAlpha: 0});
      // Rises in as the page is revealed (after the preloader or a page wipe).
      void stageReady().then(() => {
        gsap.fromTo(
          media,
          {autoAlpha: 0, scale: 0.92, y: 24},
          {autoAlpha: 1, scale: 1, y: 0, duration: DUR.slow, ease: EASE.out, delay: 0.1},
        );
      });
    }
  }, [handle]);

  // Size the 3D can to the packshot's can, whatever the stage size.
  useEffect(() => {
    const stage = stageRef.current;
    const media = mediaRef.current;
    if (!stage || !media) return;
    const measure = () => {
      const s = stage.getBoundingClientRect();
      const m = media.getBoundingClientRect();
      setFit({
        canHeightPx: m.width * CAN_HEIGHT_IN_SHOT,
        offsetYPx: m.top + m.height * CAN_CENTRE_IN_SHOT - (s.top + s.height / 2),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Swap packshot → live can once both the model and the landing are done.
  const live = landed && ready && !failed;
  useEffect(() => {
    const stage = stageRef.current;
    const media = mediaRef.current;
    const viewer = stage?.querySelector('.can-viewer');
    if (!live || !stage || !media || !viewer) return;
    const ctx = gsap.context(() => {
      if (motion) {
        gsap.fromTo(viewer, {autoAlpha: 0}, {autoAlpha: 1, duration: DUR.slow, ease: EASE.out});
        gsap.to(media, {autoAlpha: 0, duration: DUR.base, delay: 0.2, ease: EASE.inOut});
      } else {
        gsap.set(viewer, {autoAlpha: 1});
        gsap.set(media, {autoAlpha: 0});
      }
    }, stage);
    setRevealed(true);
    return () => ctx.revert();
    // Once live, the can stays live: flavour switches re-texture it instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  // Ingredient callouts pop in once the page has arrived, and again for each flavour's own list.
  const ingredientKey = ingredients.map((i) => i.name).join('|');
  const arrived = mounted && landed;
  useEffect(() => {
    const stage = stageRef.current;
    if (!arrived || !stage) return;
    const callouts = gsap.utils.toArray<HTMLElement>('.pdp-callout', stage);
    let cancelled = false;
    const ctx = gsap.context(() => {}, stage);
    if (!motion) {
      ctx.add(() => {
        gsap.set(callouts, {autoAlpha: 1});
      });
    } else {
      void stageReady().then(() => {
        if (cancelled) return;
        ctx.add(() => {
          gsap.fromTo(
            callouts,
            {autoAlpha: 0, scale: 0.6, y: 12},
            {
              autoAlpha: 1,
              scale: 1,
              y: 0,
              duration: DUR.base,
              ease: EASE.pop,
              stagger: STAGGER.items,
              delay: 0.45,
              onComplete: () => {
                ctx.add(() => startCalloutFloat(stage, callouts)); // so revert() stops the loops too
              },
            },
          );
        });
      });
    }
    return () => {
      cancelled = true;
      ctx.revert();
    };
  }, [arrived, ingredientKey, motion]);

  return (
    <div className="pdp-stage" ref={stageRef}>
      <div className="pdp-media" ref={mediaRef} data-reveal="media">
        {image && (
          <Image
            key={image.id}
            className="pdp-media-img"
            alt={image.altText || `A can of Sunfizz ${productTitle}`}
            aspectRatio="1/1"
            data={image}
            loading="eager"
            sizes="(min-width: 64em) 44vw, 92vw"
          />
        )}
      </div>

      {load3D && (
        <ViewerBoundary onError={() => setFailed(true)}>
          <Suspense fallback={null}>
            <CanViewer
              flavours={flavours}
              motion={motion}
              spinKey={handle}
              revealed={revealed}
              fit={fit}
              label={`3D view of a can of Sunfizz ${productTitle}, turning slowly`}
              onReady={() => setReady(true)}
            />
          </Suspense>
        </ViewerBoundary>
      )}

      <ul className="pdp-callouts" aria-label="Ingredients">
        {ingredients.slice(0, CALLOUT_SPOTS.length).map((ingredient, i) => {
          const Icon = INGREDIENT_ICON[ingredient.kind];
          return (
            <li
              key={ingredient.name}
              className="pdp-callout"
              data-reveal="callout"
              style={{
                left: CALLOUT_SPOTS[i].left === undefined ? undefined : `${CALLOUT_SPOTS[i].left}%`,
                right: CALLOUT_SPOTS[i].right === undefined ? undefined : `${CALLOUT_SPOTS[i].right}%`,
                top: `${CALLOUT_SPOTS[i].top}%`,
              }}
            >
              <Icon aria-hidden size={18} />
              {ingredient.name}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Gentle per-axis idle drift (ambient-idle-float-loop skill), paused while the
 * stage is scrolled away (phones, where it isn't sticky); reverted with the context.
 */
function startCalloutFloat(stage: HTMLElement, callouts: HTMLElement[]) {
  const random = gsap.utils.random;
  const loops: gsap.core.Tween[] = [];
  callouts.forEach((el, i) => {
    const base = random(3.6, 5.2);
    const loop = {ease: EASE.idle, repeat: -1, yoyo: true, delay: i * 0.2};
    loops.push(
      gsap.to(el, {x: random(-6, 6), duration: base, ...loop}),
      gsap.to(el, {y: random(-9, -4), duration: base * random(0.6, 0.85), ...loop}),
    );
  });
  ScrollTrigger.create({
    trigger: stage,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      loops.forEach((loop) => {
        loop.paused(!self.isActive);
      });
    },
  });
}

/** If WebGL can't start, keep the packshot instead of crashing the page. */
class ViewerBoundary extends Component<
  {children: ReactNode; onError: () => void},
  {failed: boolean}
> {
  state = {failed: false};
  static getDerivedStateFromError() {
    return {failed: true};
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
