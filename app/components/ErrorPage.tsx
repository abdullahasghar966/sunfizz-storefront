import {useEffect, useRef} from 'react';
import {Link} from 'react-router';
import {ArrowRight, House, RotateCcw} from 'lucide-react';
import {EASE, gsap, MOTION_OK} from '~/lib/motion';

/**
 * On-brand error page. 404: "4 (citrus wheel) 4" with the wheel slowly turning
 * and bubbles drifting up; anything else: "Our fizz went flat" with a retry.
 * Rendered inside the full site shell by the root ErrorBoundary.
 */
export function ErrorPage({status, message}: {status: number; message?: string}) {
  const ref = useRef<HTMLDivElement>(null);
  const notFound = status === 404;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const wheel = root.querySelector('.not-found-wheel');
      if (wheel) gsap.to(wheel, {rotation: 360, duration: 14, ease: 'none', repeat: -1});
      gsap.utils.toArray<HTMLElement>('.not-found-bubble', root).forEach((bubble, i) => {
        gsap.to(bubble, {
          keyframes: {y: [0, -140], opacity: [0, 0.9, 0]},
          duration: 3.2 + i * 0.5,
          ease: EASE.idle,
          repeat: -1,
          delay: i * 0.7,
        });
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <div className="not-found" ref={ref}>
      <div className="not-found-bubbles" aria-hidden="true">
        {[12, 28, 71, 86].map((x) => (
          <span className="not-found-bubble" key={x} style={{left: `${x}%`}} />
        ))}
      </div>
      <p className="sf-eyebrow">{notFound ? 'Error 404' : `Error ${status}`}</p>
      {notFound ? (
        <h1 className="not-found-code">
          <span aria-hidden="true">4</span>
          <svg className="not-found-wheel" viewBox="-50 -50 100 100" aria-hidden="true">
            <circle r="46" fill="#ff9f2e" stroke="#fff" strokeWidth="6" />
            <circle r="33" fill="#ffc56b" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <line key={a} y2="-33" stroke="#fff" strokeWidth="4" strokeLinecap="round" transform={`rotate(${a})`} />
            ))}
          </svg>
          <span aria-hidden="true">4</span>
          <span className="sr-only">Page not found</span>
        </h1>
      ) : (
        <h1 className="not-found-title">Our fizz went flat.</h1>
      )}
      <h2 className="not-found-title">{notFound ? 'This can’s empty.' : 'Something went wrong on our side.'}</h2>
      <p className="not-found-copy">
        {notFound
          ? 'We couldn’t find that page. It may have fizzed out, or the link has a typo.'
          : 'Give it a moment and try again. If it keeps happening, the drinks are still waiting on the shop page.'}
      </p>
      <div className="not-found-ctas">
        <Link className="sf-btn sf-btn--primary" to="/collections/all" data-magnetic>
          Browse the drinks <ArrowRight aria-hidden size={20} />
        </Link>
        {notFound ? (
          <Link className="sf-btn sf-btn--ghost" to="/">
            <House aria-hidden size={20} /> Back home
          </Link>
        ) : (
          <button type="button" className="sf-btn sf-btn--ghost" onClick={() => window.location.reload()}>
            <RotateCcw aria-hidden size={20} /> Try again
          </button>
        )}
      </div>
      {!notFound && import.meta.env.DEV && message ? (
        <pre className="not-found-detail">{message}</pre>
      ) : null}
    </div>
  );
}
