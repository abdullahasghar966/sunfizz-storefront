import {useEffect, useRef} from 'react';
import {Link} from 'react-router';
import {ArrowRight} from 'lucide-react';
import {DUR, EASE, gsap, MOTION_OK, STAGGER} from '~/lib/motion';

/**
 * On-brand empty cart: an empty glass waiting for a pour, a short line of copy
 * and a way back to the flavours. It fades up when it appears (e.g. after the
 * last line collapses out); its bubbles drift on idle loops only while it's shown.
 */
export function CartEmpty({
  hidden,
  active = true,
  onBrowse,
}: {
  hidden: boolean;
  /** False while the cart drawer is closed: nothing to animate for nobody. */
  active?: boolean;
  onBrowse?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || hidden || !active) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.fromTo(
        root.querySelectorAll('[data-empty-part]'),
        {autoAlpha: 0, y: 16},
        {autoAlpha: 1, y: 0, duration: DUR.base, ease: EASE.out, stagger: STAGGER.items, delay: 0.1},
      );
      // Ambient idle loops (ambient-idle-float-loop skill): one tween per axis, varied timing.
      const random = gsap.utils.random;
      gsap.utils.toArray<SVGElement>('.cart-empty-bubble', root).forEach((bubble, i) => {
        const loop = {ease: EASE.idle, repeat: -1, yoyo: true, delay: i * 0.3};
        gsap.to(bubble, {y: random(-14, -8), duration: random(1.8, 2.6), ...loop});
        gsap.to(bubble, {x: random(-3, 3), duration: random(1.2, 1.7), ...loop});
      });
    });
    return () => mm.revert();
  }, [hidden, active]);

  return (
    <div className="cart-empty" hidden={hidden} ref={ref}>
      <svg
        className="cart-empty-art"
        viewBox="0 0 160 170"
        aria-hidden="true"
        data-empty-part
      >
        {/* bubbles waiting for a drink */}
        <circle className="cart-empty-bubble" cx="62" cy="58" r="6" fill="#fff" stroke="#ff7a1a" strokeWidth="3" />
        <circle className="cart-empty-bubble" cx="86" cy="40" r="4" fill="#fff" stroke="#a8e04c" strokeWidth="2.5" />
        <circle className="cart-empty-bubble" cx="100" cy="66" r="5" fill="#fff" stroke="#ff5a5f" strokeWidth="2.5" />
        {/* empty glass */}
        <path
          d="M40 78 H120 L112 158 Q111 166 103 166 H57 Q49 166 48 158 Z"
          fill="#fff"
          fillOpacity="0.7"
          stroke="#2a1409"
          strokeOpacity="0.25"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M49 146 H111" stroke="#2a1409" strokeOpacity="0.12" strokeWidth="3" />
        <path d="M54 92 L58 138" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        {/* lemon wheel on the rim */}
        <g transform="translate(118 80) rotate(12)">
          <circle r="17" fill="#ffd23f" stroke="#fff" strokeWidth="3" />
          <circle r="12" fill="#fff0a3" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <line key={a} y2="-12" stroke="#fff" strokeWidth="2" strokeLinecap="round" transform={`rotate(${a})`} />
          ))}
        </g>
      </svg>
      <h4 className="cart-empty-title" data-empty-part>
        Your glass is empty
      </h4>
      <p className="cart-empty-copy" data-empty-part>
        Pick a flavour and we&rsquo;ll fizz it right over. Citrus, grapefruit,
        lemon or lime, all ice-cold and just 5g of sugar.
      </p>
      <Link
        className="sf-btn sf-btn--primary cart-empty-cta"
        to="/collections/all"
        onClick={onBrowse}
        prefetch="viewport"
        data-empty-part
      >
        Browse flavours <ArrowRight aria-hidden size={18} />
      </Link>
    </div>
  );
}
