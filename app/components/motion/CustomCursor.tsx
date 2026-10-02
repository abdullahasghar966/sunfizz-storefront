import {useEffect, useRef} from 'react';
import {useLocation} from 'react-router';
import {DUR, EASE, gsap} from '~/lib/motion';

// Real mice only, and only when motion is welcome. Otherwise the system cursor stays.
const CURSOR_QUERY =
  '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)';
// The drawers' full-screen click-away button is a <button> but shouldn't read as a target.
const HOVER_SELECTOR = 'a, button:not(.close-outside), [data-cursor-hover]';
// Text fields keep the native I-beam (see theme.css); the dot hides over them.
const TEXT_FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

// Elements with data-cursor-label="View" swell the dot into a labelled disc instead.
const LABEL_SELECTOR = '[data-cursor-label]';

const LERP = 0.2; // fraction of the gap closed per 60fps frame: 0.1 floaty, 0.35 tight
// Sizes in px. The disc grows by animating its real width/height, not transform
// scale: a composited 14px layer scaled ×5.6 is drawn from a 14px bitmap and
// comes out pixelated. Resizing redraws it sharp at every size.
const DOT_SIZE = 14;
const HOVER_SIZE = 45; // soft lemon disc over links and buttons
const LABEL_SIZE = 78; // ink disc with room for a short word
const PRESS_SCALE = 0.8; // shrinking a layer stays crisp; only growing blurs

/**
 * Lerped custom cursor (adapted from the lerped-custom-cursor skill): a dot that
 * trails the pointer and swells into a soft lemon disc over links and buttons,
 * or into an ink disc with a word (e.g. "View") over [data-cursor-label].
 */
export function CustomCursor() {
  const {pathname} = useLocation();
  const recheckRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(CURSOR_QUERY, () => {
      const el = document.createElement('div');
      el.className = 'cursor';
      el.setAttribute('aria-hidden', 'true');
      // The label is a sibling, not a child: it must not be scaled with the disc
      // (scaled text rasterises blurry on a will-change layer).
      const label = document.createElement('div');
      label.className = 'cursor-label';
      label.setAttribute('aria-hidden', 'true');
      document.body.append(el, label);
      document.documentElement.classList.add('has-custom-cursor');
      // Both are centred on the pointer by GSAP, whatever their current size.
      gsap.set(el, {xPercent: -50, yPercent: -50, width: DOT_SIZE, height: DOT_SIZE});
      gsap.set(label, {xPercent: -50, yPercent: -50, autoAlpha: 0});

      const target = {x: window.innerWidth / 2, y: window.innerHeight / 2};
      const pos = {...target};
      let started = false;
      const setX = gsap.quickSetter([el, label], 'x', 'px');
      const setY = gsap.quickSetter([el, label], 'y', 'px');
      const listeners = new AbortController();
      const {signal} = listeners;

      window.addEventListener(
        'pointermove',
        (event) => {
          target.x = event.clientX;
          target.y = event.clientY;
          if (!started) {
            // First move: jump there instead of gliding in from the centre.
            pos.x = target.x;
            pos.y = target.y;
            started = true;
            el.classList.add('is-visible');
          }
        },
        {passive: true, signal},
      );
      document.documentElement.addEventListener(
        'pointerleave',
        () => el.classList.remove('is-visible'),
        {signal},
      );
      document.documentElement.addEventListener(
        'pointerenter',
        () => started && el.classList.add('is-visible'),
        {signal},
      );

      const onTick = (_time: number, deltaMS: number) => {
        const k = 1 - Math.pow(1 - LERP, deltaMS / (1000 / 60)); // frame-rate independent
        pos.x += (target.x - pos.x) * k;
        pos.y += (target.y - pos.y) * k;
        setX(pos.x);
        setY(pos.y);
      };
      gsap.ticker.add(onTick);

      // What the pointer is over: a labelled element wins over a plain link.
      let current: Element | null = null;
      const targetOf = (node: EventTarget | null) => {
        const elNode = node as Element | null;
        return (
          elNode?.closest?.(LABEL_SELECTOR) ??
          elNode?.closest?.(HOVER_SELECTOR) ??
          null
        );
      };
      const restingSize = () =>
        el.classList.contains('is-label')
          ? LABEL_SIZE
          : el.classList.contains('is-hover')
            ? HOVER_SIZE
            : DOT_SIZE;
      const setTarget = (target: Element | null) => {
        if (target === current) return;
        current = target;
        const text = target?.getAttribute('data-cursor-label') ?? '';
        el.classList.toggle('is-label', Boolean(text));
        el.classList.toggle('is-hover', Boolean(target) && !text);
        const size = restingSize();
        gsap.to(el, {
          width: size,
          height: size,
          duration: DUR.fast + 0.1,
          ease: EASE.pop,
          overwrite: 'auto',
        });
        if (text) label.textContent = text;
        gsap.to(label, {
          autoAlpha: text ? 1 : 0,
          scale: text ? 1 : 0.6,
          duration: text ? DUR.fast : DUR.micro,
          ease: text ? EASE.pop : EASE.in,
          overwrite: 'auto',
        });
      };
      // After a route change the element under the pointer was swapped without
      // any pointerout, so look again at what is under it now.
      recheckRef.current = () => {
        if (!started) return;
        setTarget(targetOf(document.elementFromPoint(target.x, target.y)));
      };
      document.addEventListener(
        'pointerover',
        (event) => {
          const node = event.target as Element;
          el.classList.toggle(
            'is-hidden',
            Boolean(node.closest?.(TEXT_FIELD_SELECTOR)),
          );
          setTarget(targetOf(node));
        },
        {signal},
      );
      document.addEventListener(
        'pointerout',
        (event) => {
          // Moving between children of one link resolves to the same target: no change.
          setTarget(targetOf(event.relatedTarget));
        },
        {signal},
      );
      document.addEventListener(
        'pointerdown',
        () => {
          gsap.to(el, {scale: PRESS_SCALE, duration: DUR.micro, overwrite: 'auto'});
        },
        {signal},
      );
      document.addEventListener(
        'pointerup',
        () => {
          gsap.to(el, {scale: 1, duration: DUR.fast, ease: EASE.pop, overwrite: 'auto'});
        },
        {signal},
      );

      return () => {
        recheckRef.current = null;
        listeners.abort();
        gsap.ticker.remove(onTick);
        gsap.killTweensOf([el, label]);
        el.remove();
        label.remove();
        document.documentElement.classList.remove('has-custom-cursor');
      };
    });

    return () => mm.revert();
  }, []);

  useEffect(() => {
    recheckRef.current?.();
  }, [pathname]);

  return null;
}
