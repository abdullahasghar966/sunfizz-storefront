import {useEffect, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router';
import {type MappedProductOptions} from '@shopify/hydrogen';
import {Check, ShoppingBag} from 'lucide-react';
import {AddToCartButton} from '~/components/AddToCartButton';
import {useAside} from '~/components/Aside';
import {ProductPrice} from '~/components/ProductPrice';
import {DUR, EASE, gsap, MOTION_OK} from '~/lib/motion';
import {flavourFor, flavourStyle} from '~/lib/flavours';
import type {ProductFragment} from 'storefrontapi.generated';

type Sibling = {id: string; handle: string; title: string; tags: string[]};

const ADDED_MS = 1800; // how long the button says "Added"
const DRAWER_DELAY_MS = 650; // let the pulse play before the cart drawer covers it

/**
 * Flavour swatches (the sibling products of the flavour collection), pack size
 * (real Shopify variants), price, and add to cart. Add to cart is the Phase 1
 * <AddToCartButton> (Hydrogen CartForm) plus a pulse + fizz burst on click;
 * the cart drawer opens once the pulse has played.
 */
export function ProductBuyBox({
  product,
  selectedVariant,
  productOptions,
  siblings,
}: {
  product: {handle: string; title: string};
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  productOptions: MappedProductOptions[];
  siblings: Sibling[];
}) {
  const navigate = useNavigate();
  const {open} = useAside();
  const atcRef = useRef<HTMLDivElement>(null);
  const [added, setAdded] = useState(false);
  const timers = useRef<number[]>([]);
  const available = Boolean(selectedVariant?.availableForSale);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  // Keep the chosen pack size when hopping to another flavour, where it exists.
  const sizeQuery = new URLSearchParams(
    (selectedVariant?.selectedOptions ?? []).map((o) => [o.name, o.value]),
  ).toString();

  const onAddClick = () => {
    const button = atcRef.current?.querySelector('button');
    const motionOK = window.matchMedia(MOTION_OK).matches;
    setAdded(true);
    timers.current.push(window.setTimeout(() => setAdded(false), ADDED_MS));
    if (!motionOK || !button || !atcRef.current) {
      open('cart');
      return;
    }
    pulse(button);
    fizzBurst(atcRef.current);
    timers.current.push(window.setTimeout(() => open('cart'), DRAWER_DELAY_MS));
  };

  const current = siblings.find((s) => s.handle === product.handle);

  return (
    <div className="pdp-buy">
      <ProductPrice
        price={selectedVariant?.price}
        compareAtPrice={selectedVariant?.compareAtPrice}
      />

      {siblings.length > 1 && (
        <div className="pdp-picker" role="group" aria-labelledby="pdp-flavour-label">
          <p className="pdp-picker-label" id="pdp-flavour-label">
            Flavour{' '}
            <span className="pdp-picker-value">{current?.title ?? product.title}</span>
          </p>
          <div className="pdp-swatches">
            {siblings.map((sibling) => {
              const isCurrent = sibling.handle === product.handle;
              return (
                <Link
                  key={sibling.id}
                  className="pdp-swatch"
                  to={`/products/${sibling.handle}${sizeQuery ? `?${sizeQuery}` : ''}`}
                  prefetch="intent"
                  preventScrollReset
                  data-transition="none"
                  aria-current={isCurrent ? 'true' : undefined}
                  aria-label={sibling.title}
                  title={sibling.title}
                  style={flavourStyle(flavourFor(sibling.tags))}
                >
                  <span className="pdp-swatch-dot" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {productOptions
        .filter((option) => option.optionValues.length > 1)
        .map((option) => (
          <div
            className="pdp-picker"
            role="group"
            aria-labelledby={`pdp-option-${option.name}`}
            key={option.name}
          >
            <p className="pdp-picker-label" id={`pdp-option-${option.name}`}>
              {option.name}
            </p>
            <div className="pdp-pills">
              {option.optionValues.map((value) => (
                <button
                  key={option.name + value.name}
                  type="button"
                  className="pdp-pill"
                  aria-pressed={value.selected}
                  disabled={!value.exists}
                  data-unavailable={!value.available || undefined}
                  onClick={() => {
                    if (!value.selected) {
                      void navigate(`?${value.variantUriQuery}`, {
                        replace: true,
                        preventScrollReset: true,
                      });
                    }
                  }}
                >
                  {value.name}
                </button>
              ))}
            </div>
          </div>
        ))}

      <div
        className="pdp-atc"
        ref={atcRef}
        data-added={added || undefined}
        data-magnetic="0.12"
      >
        <AddToCartButton
          disabled={!selectedVariant || !available}
          onClick={onAddClick}
          lines={
            selectedVariant
              ? [{merchandiseId: selectedVariant.id, quantity: 1, selectedVariant}]
              : []
          }
        >
          {!available ? (
            'Sold out'
          ) : added ? (
            <>
              <Check aria-hidden size={20} /> Added to cart
            </>
          ) : (
            <>
              <ShoppingBag aria-hidden size={20} /> Add to cart
            </>
          )}
        </AddToCartButton>
        <span className="sr-only" aria-live="polite">
          {added ? `${product.title} added to cart` : ''}
        </span>
      </div>
    </div>
  );
}

/** Squash, spring back, and flash lemon: "got it". */
function pulse(button: HTMLElement) {
  // The button's CSS background-color transition would smear GSAP's colour tween.
  gsap.set(button, {transition: 'none'});
  gsap
    .timeline({
      onComplete: () => {
        gsap.set(button, {clearProps: 'scale,backgroundColor,color,transition'});
      },
    })
    .to(button, {scale: 0.93, duration: 0.1, ease: 'power2.out'})
    .to(button, {backgroundColor: '#ffd23f', color: '#2a1409', duration: 0.12}, '<')
    .to(button, {scale: 1, duration: DUR.slow - 0.2, ease: EASE.spring})
    .to(button, {backgroundColor: '#2a1409', color: '#fff7e8', duration: DUR.base}, '-=0.25');
}

/** A handful of bubbles fizz up out of the button, then pop. */
function fizzBurst(host: HTMLElement) {
  const random = gsap.utils.random;
  const colors = ['#ff7a1a', '#ffd23f', '#a8e04c', '#ff5a5f'];
  for (let i = 0; i < 12; i++) {
    const bubble = document.createElement('span');
    bubble.className = 'pdp-fizz';
    bubble.style.borderColor = colors[i % colors.length];
    host.appendChild(bubble);
    const size = random(8, 18);
    gsap.fromTo(
      bubble,
      {
        width: size,
        height: size,
        xPercent: -50,
        yPercent: -50,
        x: random(-40, 40),
        y: 0,
        scale: 0.3,
        autoAlpha: 1,
      },
      {
        x: `+=${random(-70, 70)}`,
        y: random(-90, -40),
        scale: 1,
        autoAlpha: 0,
        duration: random(0.6, 0.95),
        ease: EASE.out,
        delay: i * 0.018,
        onComplete: () => bubble.remove(),
      },
    );
  }
}
