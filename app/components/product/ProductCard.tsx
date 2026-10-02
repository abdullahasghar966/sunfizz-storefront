import {useRef} from 'react';
import {Link} from 'react-router';
import {Image} from '@shopify/hydrogen';
import {Money} from '~/components/Money';
import {flavourFor, flavourStyle} from '~/lib/flavours';
import {launchMorph} from '~/lib/route-morph';
import {useVariantUrl} from '~/lib/variants';
import type {ProductCardFragment} from 'storefrontapi.generated';

/**
 * Listing card: packshot that cross-fades into the product's second Shopify
 * image (the poured glass) on hover. The fade is pure CSS (shop.css); the
 * entrance stagger lives in ProductGrid; the cursor shows "View" over it.
 * Clicking starts the card → product page morph (lib/route-morph).
 */
export function ProductCard({
  product,
  loading,
  headingLevel = 2,
}: {
  product: ProductCardFragment;
  loading?: 'eager' | 'lazy';
  /** 2 on the listing (under the page h1), 3 inside a section (homepage). */
  headingLevel?: 2 | 3;
}) {
  const Title = headingLevel === 3 ? 'h3' : 'h2';
  const url = useVariantUrl(product.handle);
  const mediaRef = useRef<HTMLDivElement>(null);
  const flavour = flavourFor(product.tags);
  const [main, alt] = product.images.nodes;
  const {minVariantPrice, maxVariantPrice} = product.priceRange;
  const fromPrice = minVariantPrice.amount !== maxVariantPrice.amount;

  return (
    <article
      className="pcard"
      data-card
      data-reveal="card"
      style={flavourStyle(flavour)}
    >
      <Link
        className="pcard-link"
        to={url}
        prefetch="intent"
        data-cursor-label="View"
        data-transition="morph"
        onClick={(event) => {
          // Plain left clicks only: new-tab / modifier clicks keep native behaviour.
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            !mediaRef.current
          ) {
            return;
          }
          launchMorph(
            product.handle,
            mediaRef.current,
            mediaRef.current.closest('[data-morph-page]'),
          );
        }}
      >
        <div
          className={`pcard-media${alt ? ' has-alt' : ''}`}
          ref={mediaRef}
        >
          {main && (
            <Image
              className="pcard-img pcard-img--main"
              alt={main.altText || product.title}
              aspectRatio="1/1"
              data={main}
              loading={loading}
              sizes="(min-width: 64em) 30vw, (min-width: 45em) 45vw, 50vw"
            />
          )}
          {alt && (
            // Decorative: the card's text already names the product.
            <Image
              className="pcard-img pcard-img--alt"
              alt=""
              aria-hidden="true"
              aspectRatio="1/1"
              data={alt}
              loading={loading}
              sizes="(min-width: 64em) 30vw, (min-width: 45em) 45vw, 50vw"
            />
          )}
        </div>
        <div className="pcard-body">
          {flavour && (
            <p className="pcard-notes">
              <span className="pcard-swatch" aria-hidden="true" />
              {flavour.notes}
            </p>
          )}
          <Title className="pcard-title">{product.title}</Title>
          {/* A div, not a p: <Money> renders a div, and a div inside a p breaks hydration. */}
          <div className="pcard-price">
            {fromPrice && <span className="pcard-from">From </span>}
            <Money data={minVariantPrice} />
          </div>
        </div>
      </Link>
    </article>
  );
}

export const PRODUCT_CARD_FRAGMENT = `#graphql
  fragment ProductCardMoney on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductCard on Product {
    id
    handle
    title
    tags
    images(first: 2) {
      nodes {
        id
        altText
        url
        width
        height
      }
    }
    priceRange {
      minVariantPrice {
        ...ProductCardMoney
      }
      maxVariantPrice {
        ...ProductCardMoney
      }
    }
  }
` as const;
