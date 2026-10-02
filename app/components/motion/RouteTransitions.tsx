import {useEffect, useLayoutEffect} from 'react';
import {useLocation, useNavigation} from 'react-router';
import {EASE, DUR, gsap, MOTION_OK, STAGGER} from '~/lib/motion';
import {pourCover, pourReset, pourReveal, pourShowCenter} from '~/lib/pour';
import {closeStage, openStage} from '~/lib/stage';
import {hasMorphInFlight} from '~/lib/route-morph';

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Show the wordmark on the liquid if a page takes longer than this to arrive. */
const SLOW_MS = 700;

type Phase = 'idle' | 'covering' | 'covered';

/**
 * Transition state lives at module level, not in the component: when a route
 * errors, the root ErrorBoundary swaps the whole shell (and this component)
 * mid-transition, and the new instance must be able to finish the reveal.
 */
const state: {
  phase: Phase;
  coverDone: Promise<void> | null;
  committedPath: string | null;
  slowTimer: number | undefined;
  hint: string | null;
} = {phase: 'idle', coverDone: null, committedPath: null, slowTimer: undefined, hint: null};

/**
 * One transition for every route change (links, back/forward, redirects,
 * form GETs): driven by React Router's navigation state, not by intercepting
 * clicks, so nothing can navigate around it.
 *
 * 1. Navigation to another pathname starts → the pour rises (cover) and the
 *    stage gate closes, so the next page's entrances wait.
 * 2. The new page commits → if the liquid hasn't finished covering, the new
 *    page stays hidden (no flash in the still-uncovered strip) until it has.
 * 3. Covered + committed → the stage opens and the liquid keeps rising away
 *    (reveal); the page's own entrance plays as it lifts. Pages without a
 *    custom entrance get a gentle rise of their top-level blocks.
 *
 * Opt-outs: the listing → product card morph (Phase 3) is its own transition;
 * links marked data-transition="none" (flavour swatches) keep the page; same-
 * pathname changes (variants, pagination) never transition. Reduced motion:
 * nothing, plain instant navigation.
 */
export function RouteTransitions() {
  const navigation = useNavigation();
  const location = useLocation();
  state.committedPath ??= location.pathname;

  // Remember what the last clicked link asked for (e.g. data-transition="none").
  useEffect(() => {
    let timer: number | undefined;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href]');
      state.hint = link?.closest('[data-transition]')?.getAttribute('data-transition') ?? null;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        state.hint = null;
      }, 1500);
    };
    window.addEventListener('click', onClick, {capture: true});
    return () => {
      window.removeEventListener('click', onClick, {capture: true});
      window.clearTimeout(timer);
    };
  }, []);

  // Mounted in the middle of a transition (e.g. the error shell replaced the app): finish it.
  useEffect(() => {
    if (state.phase !== 'idle' && state.committedPath === location.pathname) {
      void finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1. A navigation to another page started: cover.
  const target = navigation.location?.pathname;
  useEffect(() => {
    if (navigation.state === 'idle') {
      // Cancelled or failed before committing a new page: uncover.
      if (state.phase !== 'idle' && state.committedPath === location.pathname) {
        void finish();
      }
      return;
    }
    if (!target || target === location.pathname || state.phase !== 'idle') return;
    if (state.hint === 'none' || state.hint === 'morph' || hasMorphInFlight()) return;
    if (!window.matchMedia(MOTION_OK).matches) return;

    state.phase = 'covering';
    closeStage();
    state.coverDone = pourCover().then(() => {
      if (state.phase === 'covering') state.phase = 'covered';
    });
    window.clearTimeout(state.slowTimer);
    state.slowTimer = window.setTimeout(pourShowCenter, SLOW_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation.state, target]);

  // 2 + 3. The new page committed: keep it hidden until covered, then reveal.
  useIsomorphicLayoutEffect(() => {
    if (location.pathname === state.committedPath) return;
    state.committedPath = location.pathname;
    if (state.phase === 'idle') return;
    const main = document.querySelector<HTMLElement>('body > main');
    if (main) gsap.set(main, {autoAlpha: 0});
    void finish();
  }, [location.pathname]);

  // Coming back through the back/forward cache with the liquid up: put it away.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      state.phase = 'idle';
      state.coverDone = null;
      pourReset();
      openStage();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return null;
}

let finishing: Promise<void> | null = null;

/** Wait for the cover, then open the stage and let the liquid rise away. */
function finish() {
  finishing ??= (async () => {
    await state.coverDone;
    window.clearTimeout(state.slowTimer);
    const main = document.querySelector<HTMLElement>('body > main');
    if (main) gsap.set(main, {clearProps: 'opacity,visibility'});
    state.phase = 'idle';
    state.coverDone = null;
    openStage();
    enterGenericPage(main);
    await pourReveal();
  })().finally(() => {
    finishing = null;
  });
  return finishing;
}

/**
 * Pages with their own entrance (home hero, listing, product page) mark their
 * root with data-entrance; everything else gets its top-level blocks rising in.
 */
function enterGenericPage(main: HTMLElement | null) {
  if (!main || main.querySelector('[data-entrance]')) return;
  // A route usually renders one wrapper; its children are the blocks to stagger.
  const root = main.children.length === 1 ? main.children[0] : main;
  const blocks = gsap.utils.toArray<HTMLElement>(root.children).slice(0, 8);
  if (!blocks.length) return;
  gsap.fromTo(
    blocks,
    {autoAlpha: 0, y: 28},
    {
      autoAlpha: 1,
      y: 0,
      duration: DUR.slow,
      ease: EASE.out,
      stagger: STAGGER.items,
      delay: 0.1,
      clearProps: 'opacity,visibility,transform',
    },
  );
}
