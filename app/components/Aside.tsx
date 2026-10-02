import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {useId} from 'react';
import {X} from 'lucide-react';
import {DUR, EASE, gsap, MOTION_OK} from '~/lib/motion';

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Drawer motion: a weighted slide in (fast start, long soft landing), a quicker
// slide out, and a dimmed + blurred backdrop that fades with it.
const OPEN = {duration: DUR.slow, ease: EASE.expo};
const CLOSE = {duration: DUR.fast + 0.05, ease: EASE.in};
const BACKDROP = {in: DUR.base, out: DUR.fast};

type AsideType = 'search' | 'cart' | 'mobile' | 'closed';
type AsideContextValue = {
  type: AsideType;
  open: (mode: AsideType) => void;
  close: () => void;
};

/**
 * A side bar component with Overlay
 * @example
 * ```jsx
 * <Aside type="search" heading="SEARCH">
 *  <input type="search" />
 *  ...
 * </Aside>
 * ```
 */
export function Aside({
  children,
  heading,
  type,
}: {
  children?: React.ReactNode;
  type: AsideType;
  heading: React.ReactNode;
}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;
  const id = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const mounted = useRef(false);

  // GSAP owns the show/hide: the overlay stays visible until the slide-out has finished.
  useIsomorphicLayoutEffect(() => {
    const overlay = overlayRef.current;
    const panel = overlay?.querySelector('aside');
    const backdrop = overlay?.querySelector('.close-outside');
    if (!overlay || !panel || !backdrop) return;
    const motion = window.matchMedia(MOTION_OK).matches;
    gsap.killTweensOf([panel, backdrop]);

    if (!mounted.current) {
      // First render: park the panel off-screen without animating.
      mounted.current = true;
      if (!expanded) {
        gsap.set(panel, {xPercent: 100});
        gsap.set(backdrop, {opacity: 0});
        gsap.set(overlay, {visibility: 'hidden'});
        return;
      }
    }

    if (expanded) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      // The locked page keeps an empty scrollbar gutter (cart.css, so nothing
      // shifts), but fixed boxes stop short of it: with classic (Windows)
      // scrollbars that left a strip of undimmed page beside the drawer. Let the
      // backdrop and panel cover it (0px with overlay scrollbars).
      const html = document.documentElement;
      const gutter = window.innerWidth - html.getBoundingClientRect().width;
      html.style.setProperty('--sf-scrollbar', `${Math.max(0, gutter)}px`);
      gsap.set(overlay, {visibility: 'visible'});
      if (motion) {
        gsap.to(panel, {xPercent: 0, ...OPEN});
        gsap.to(backdrop, {opacity: 1, duration: BACKDROP.in, ease: EASE.out});
      } else {
        gsap.set(panel, {xPercent: 0});
        gsap.set(backdrop, {opacity: 1});
      }
      // Keyboard and screen-reader users land inside the dialog.
      overlay.querySelector<HTMLElement>('aside header .close')?.focus({preventScroll: true});
      return;
    }

    const hide = () => {
      gsap.set(overlay, {visibility: 'hidden'});
    };
    if (motion && gsap.getProperty(panel, 'xPercent') !== 100) {
      // Hide the overlay when the (longer) panel slide ends, not the backdrop fade.
      gsap.to(panel, {xPercent: 100, ...CLOSE, onComplete: hide});
      gsap.to(backdrop, {opacity: 0, duration: BACKDROP.out, ease: EASE.in});
    } else {
      gsap.set(panel, {xPercent: 100});
      gsap.set(backdrop, {opacity: 0});
      hide();
    }
    // Give focus back to whatever opened the drawer (e.g. the cart icon), or at
    // least don't leave it on a control that's about to be hidden.
    if (overlay.contains(document.activeElement)) {
      const opener = returnFocus.current;
      if (opener?.isConnected && opener !== document.body) {
        opener.focus({preventScroll: true});
      } else {
        (document.activeElement as HTMLElement | null)?.blur();
      }
    }
    returnFocus.current = null;
  }, [expanded]);

  useEffect(() => {
    const abortController = new AbortController();

    if (expanded) {
      document.addEventListener(
        'keydown',
        function handler(event: KeyboardEvent) {
          if (event.key === 'Escape') {
            close();
          }
        },
        {signal: abortController.signal},
      );
    }
    return () => abortController.abort();
  }, [close, expanded]);

  return (
    <div
      aria-modal
      className={`overlay ${expanded ? 'expanded' : ''}`}
      role="dialog"
      aria-labelledby={id}
      ref={overlayRef}
      data-aside-type={type}
    >
      <button
        className="close-outside"
        onClick={close}
        aria-label="Close"
        tabIndex={-1}
      />
      <aside>
        <header>
          <h3 id={id}>{heading}</h3>
          <button className="close reset" onClick={close} aria-label="Close">
            <X aria-hidden />
          </button>
        </header>
        {/* Not a <main>: the page already has one landmark of that kind. */}
        <div className="aside-main">{children}</div>
      </aside>
    </div>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * While a drawer is open, the rest of the page is inert (no focus, no clicks,
 * hidden from screen readers) and Tab wraps inside the drawer.
 */
function useDrawerFocusTrap(type: AsideType) {
  useEffect(() => {
    if (type === 'closed') return;
    const overlay = document.querySelector<HTMLElement>(`[data-aside-type="${type}"]`);
    if (!overlay) return;
    const outside = Array.from(document.body.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && el !== overlay && !el.inert,
    );
    outside.forEach((el) => {
      el.inert = true;
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      outside.forEach((el) => {
        el.inert = false;
      });
    };
  }, [type]);
}

const AsideContext = createContext<AsideContextValue | null>(null);

Aside.Provider = function AsideProvider({children}: {children: ReactNode}) {
  const [type, setType] = useState<AsideType>('closed');
  useDrawerFocusTrap(type);

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        close: () => setType('closed'),
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}
