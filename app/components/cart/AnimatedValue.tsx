import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {DUR, EASE, gsap, MOTION_OK} from '~/lib/motion';

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Same output as components/Money.tsx (decimals pinned: none for whole
 * amounts, two otherwise), so server and browser print identical strings.
 */
export function formatMoney(amount: number, currencyCode: string, fractionDigits?: number) {
  const digits = fractionDigits ?? (Number.isInteger(amount) ? 0 : 2);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

type MoneyData = {amount?: string | null; currencyCode?: string | null};

/**
 * A price that counts smoothly from its previous value to the new one
 * (quantity changes, subtotal updates) instead of snapping. The tween writes
 * textContent directly, so React doesn't re-render per frame. Instant under
 * reduced motion.
 */
export function AnimatedMoney({data}: {data?: MoneyData | null}) {
  const ref = useRef<HTMLDivElement>(null);
  const amount = Number(data?.amount ?? NaN);
  const currency = data?.currencyCode ?? '';
  const shown = useRef({value: amount});
  // React only ever renders the first value; after that the effect owns the
  // text, so React never writes to a text node the tween has replaced.
  const [initialText] = useState(() =>
    currency && !Number.isNaN(amount) ? formatMoney(amount, currency) : '',
  );

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el || !currency || Number.isNaN(amount)) return;
    const from = shown.current.value;
    if (from === amount || Number.isNaN(from) || !window.matchMedia(MOTION_OK).matches) {
      shown.current.value = amount;
      el.textContent = formatMoney(amount, currency);
      return;
    }
    // Count in the target's precision, so PKR 4,500 → 6,000 never flashes decimals.
    const digits = Number.isInteger(amount) && Number.isInteger(from) ? 0 : 2;
    el.textContent = formatMoney(from, currency, digits);
    const tween = gsap.to(shown.current, {
      value: amount,
      duration: DUR.base,
      ease: EASE.out,
      onUpdate: () => {
        el.textContent = formatMoney(
          digits === 0 ? Math.round(shown.current.value) : shown.current.value,
          currency,
          digits,
        );
      },
      onComplete: () => {
        el.textContent = formatMoney(amount, currency);
      },
    });
    return () => {
      tween.kill();
    };
  }, [amount, currency]);

  if (!data?.amount || !data.currencyCode) return null;
  return <div ref={ref}>{initialText}</div>;
}

/**
 * A small integer that rolls like an odometer when it changes: the old value
 * slides out one way while the new one slides in, direction following the
 * change (up for more, down for less).
 */
export function AnimatedNumber({value}: {value: number}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const currentRef = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);

  useIsomorphicLayoutEffect(() => {
    const wrap = wrapRef.current;
    const current = currentRef.current;
    const from = previous.current;
    previous.current = value;
    if (!wrap || !current || from === value || !window.matchMedia(MOTION_OK).matches) {
      return;
    }
    const dir = value > from ? 1 : -1;
    const outgoing = document.createElement('span');
    outgoing.className = 'num-roll-out';
    outgoing.setAttribute('aria-hidden', 'true');
    outgoing.textContent = String(from);
    wrap.appendChild(outgoing);
    const tl = gsap
      .timeline({onComplete: () => outgoing.remove()})
      .to(outgoing, {yPercent: -100 * dir, autoAlpha: 0, duration: DUR.fast, ease: EASE.in}, 0)
      .fromTo(
        current,
        {yPercent: 100 * dir, autoAlpha: 0},
        {yPercent: 0, autoAlpha: 1, duration: DUR.fast + 0.05, ease: EASE.pop},
        0.05,
      );
    return () => {
      tl.kill();
      outgoing.remove();
      gsap.set(current, {clearProps: 'all'});
    };
  }, [value]);

  return (
    <span className="num-roll" ref={wrapRef}>
      <span ref={currentRef}>{value}</span>
    </span>
  );
}
