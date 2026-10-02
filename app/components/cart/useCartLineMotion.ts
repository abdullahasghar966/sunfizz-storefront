import {useEffect, useLayoutEffect, useRef, type RefObject} from 'react';
import {DUR, EASE, gsap, MOTION_OK, STAGGER} from '~/lib/motion';
import type {Presence} from '~/lib/usePresence';

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

const ENTER = {duration: DUR.base, ease: EASE.out, x: 32};
const EXIT = {duration: DUR.fast + 0.05, ease: EASE.inOut, x: 28};
const OPEN_STAGGER = {duration: DUR.base, ease: EASE.out, y: 18, stagger: STAGGER.items, delay: 0.15};
const FRESH_FLASH = 'rgba(255, 210, 63, 0.5)'; // lemon, fades to clear

type Line = {quantity?: number};

/**
 * Animates cart lines individually:
 * - a line that appears while the list is visible grows in (height 0 → auto) and slides in;
 * - a removed line (kept on screen by usePresence) collapses (height + opacity) and only
 *   then leaves the DOM, so the rest of the list reflows smoothly;
 * - when the drawer opens, its lines stagger in, and lines added or topped up since it
 *   was last open get a short lemon flash, connecting "added" to "here it is".
 * Under reduced motion every change is instant.
 */
export function useCartLineMotion<T extends Line>({
  listRef,
  presence,
  done,
  layout,
  drawerOpen,
}: {
  listRef: RefObject<HTMLUListElement | null>;
  presence: Presence<T>[];
  done: (key: string) => void;
  layout: 'page' | 'aside';
  drawerOpen: boolean;
}) {
  const seen = useRef<Set<string> | null>(null);
  const leaving = useRef(new Set<string>());
  const quantities = () =>
    new Map(presence.filter((p) => !p.exiting).map((p) => [p.key, p.item.quantity ?? 0]));
  const snapshot = useRef<Map<string, number> | null>(null);
  const wasOpen = useRef(drawerOpen);

  // Enter / exit, checked after every commit.
  useIsomorphicLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const motion = window.matchMedia(MOTION_OK).matches;
    const liFor = (key: string) =>
      list.querySelector<HTMLElement>(`:scope > [data-line-key="${CSS.escape(key)}"]`);

    if (!seen.current) {
      // First commit: whatever is already in the cart isn't "new".
      seen.current = new Set(presence.map((p) => p.key));
      snapshot.current = quantities();
      return;
    }
    const visible = layout === 'page' || drawerOpen;

    presence.forEach(({key, exiting}) => {
      const li = liFor(key);
      if (!li) return;

      if (exiting) {
        if (leaving.current.has(key)) return;
        leaving.current.add(key);
        li.inert = true; // no clicks on a line that's on its way out
        const finish = () => {
          leaving.current.delete(key);
          seen.current?.delete(key);
          done(key);
        };
        if (!motion || !visible) {
          finish();
          return;
        }
        gsap.set(li, {height: li.offsetHeight, overflow: 'hidden'});
        gsap.to(li, {
          height: 0,
          paddingTop: 0,
          paddingBottom: 0,
          marginTop: 0,
          marginBottom: 0,
          borderWidth: 0,
          autoAlpha: 0,
          x: EXIT.x,
          duration: EXIT.duration,
          ease: EXIT.ease,
          onComplete: finish,
        });
        return;
      }

      if (leaving.current.has(key)) {
        // It came back (the removal failed): undo the collapse.
        leaving.current.delete(key);
        li.inert = false;
        gsap.killTweensOf(li);
        gsap.set(li, {clearProps: 'all'});
      }

      if (!seen.current?.has(key)) {
        seen.current?.add(key);
        if (motion && visible) {
          gsap.fromTo(
            li,
            {height: 0, autoAlpha: 0, x: ENTER.x, overflow: 'hidden'},
            {
              height: 'auto',
              autoAlpha: 1,
              x: 0,
              duration: ENTER.duration,
              ease: ENTER.ease,
              clearProps: 'height,overflow,transform,opacity,visibility',
            },
          );
        }
      }
    });
  });

  // Drawer open: stagger the lines in and flash the fresh ones. Drawer close: remember quantities.
  useEffect(() => {
    if (layout !== 'aside') return;
    const list = listRef.current;
    const opened = drawerOpen && !wasOpen.current;
    const closed = !drawerOpen && wasOpen.current;
    wasOpen.current = drawerOpen;
    if (closed) {
      snapshot.current = quantities();
      return;
    }
    if (!opened || !list) return;

    const before = snapshot.current ?? new Map<string, number>();
    const lines = gsap.utils.toArray<HTMLElement>(':scope > .cart-line:not([data-exiting])', list);
    const fresh = lines.filter((li) => {
      const key = li.dataset.lineKey ?? '';
      const now = presence.find((p) => p.key === key)?.item.quantity ?? 0;
      return !before.has(key) || now > (before.get(key) ?? 0);
    });
    if (!window.matchMedia(MOTION_OK).matches) return;

    const tweens = [
      gsap.fromTo(
        lines,
        {autoAlpha: 0, y: OPEN_STAGGER.y},
        {
          autoAlpha: 1,
          y: 0,
          duration: OPEN_STAGGER.duration,
          ease: OPEN_STAGGER.ease,
          stagger: OPEN_STAGGER.stagger,
          delay: OPEN_STAGGER.delay,
          clearProps: 'transform,opacity,visibility',
        },
      ),
      ...fresh.map((li) =>
        gsap.fromTo(
          li.querySelector('.cart-line-inner'),
          {backgroundColor: FRESH_FLASH},
          {
            backgroundColor: 'rgba(255, 210, 63, 0)',
            duration: DUR.hero + 0.2,
            delay: 0.55,
            ease: EASE.out,
            clearProps: 'backgroundColor',
          },
        ),
      ),
    ];
    return () => {
      tweens.forEach((t) => {
        t.progress(1).kill();
      });
    };
    // Only reacts to the drawer opening/closing; `presence` is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, layout]);
}
