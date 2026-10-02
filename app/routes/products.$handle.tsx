import {useEffect, useRef} from 'react';
import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/products.$handle';
import {clip, pageMeta} from '~/lib/seo';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ArrowLeft} from 'lucide-react';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {DUR, EASE, gsap, MOTION_OK, STAGGER} from '~/lib/motion';
import {stageReady} from '~/lib/stage';
import {
  byFlavourOrder,
  FLAVOUR_COLLECTION_HANDLE,
  FLAVOUR_ORDER,
  FLAVOURS,
  flavourFor,
  flavourStyle,
} from '~/lib/flavours';
import {ProductStage} from '~/components/product/ProductStage';
import {ProductTitle} from '~/components/product/ProductTitle';
import {ProductBuyBox} from '~/components/product/ProductBuyBox';

export const meta: Route.MetaFunction = (args) => {
  const product = args.data?.product;
  if (!product) return pageMeta(args);
  const image = product.featuredImage;
  const variant = product.selectedOrFirstAvailableVariant;
  const description = clip(product.seo?.description || product.description);
  return pageMeta(args, {
    title: product.title,
    description,
    media: image
      ? {
          type: 'image',
          // A 1200px share image (the originals are 2000px) keeps link previews fast.
          url: `${image.url}${image.url.includes('?') ? '&' : '?'}width=1200`,
          width: 1200,
          height: image.width && image.height ? Math.round((1200 * image.height) / image.width) : 1200,
          altText: image.altText ?? `A can of Sunfizz ${product.title}`,
        }
      : undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      description,
      image: image?.url,
      brand: {'@type': 'Brand', name: product.vendor || 'Sunfizz'},
      offers: variant
        ? {
            '@type': 'Offer',
            price: variant.price.amount,
            priceCurrency: variant.price.currencyCode,
            availability: variant.availableForSale
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          }
        : undefined,
    },
  });
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}, {collection}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    // The other flavours, for the flavour swatches.
    storefront.query(FLAVOUR_SIBLINGS_QUERY, {
      variables: {handle: FLAVOUR_COLLECTION_HANDLE},
    }),
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  return {
    product,
    siblings: byFlavourOrder(collection?.products.nodes ?? []),
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params}: Route.LoaderArgs) {
  // Put any API calls that is not critical to be available on first page render
  // For example: product reviews, product recommendations, social feeds.

  return {};
}

export default function Product() {
  const {product, siblings} = useLoaderData<typeof loader>();
  const rootRef = useRef<HTMLDivElement>(null);

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml} = product;
  const flavour = flavourFor(product.tags);
  const cans =
    flavour?.key === 'variety'
      ? FLAVOUR_ORDER.map((key) => FLAVOURS[key])
      : flavour
        ? [flavour]
        : [];

  // Info column entrance (the title has its own SplitText reveal).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, (context) => {
      let cancelled = false;
      root.dataset.motion = 'on'; // JS owns the load reveals from here
      const info = gsap.utils.toArray<HTMLElement>('[data-reveal="info"]', root);
      gsap.set(info, {autoAlpha: 0});
      void stageReady().then(() => {
        if (cancelled) return;
        context.add(() => {
          gsap.fromTo(
            info,
            {autoAlpha: 0, y: 26},
            {
              autoAlpha: 1,
              y: 0,
              duration: DUR.slow,
              ease: EASE.out,
              stagger: STAGGER.items,
              delay: 0.25,
            },
          );
        });
      });
      return () => {
        cancelled = true;
        delete root.dataset.motion;
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <div
      className="pdp"
      ref={rootRef}
      style={flavourStyle(flavour)}
      data-entrance
    >
      <div className="pdp-layout">
        <ProductStage
          handle={product.handle}
          productTitle={product.title}
          image={product.featuredImage}
          flavours={cans}
          ingredients={flavour?.ingredients ?? []}
        />
        <div className="pdp-info">
          <Link className="pdp-back" to="/collections/all" data-reveal="info" prefetch="intent">
            <ArrowLeft aria-hidden size={18} /> All drinks
          </Link>
          <p className="sf-eyebrow pdp-eyebrow" data-reveal="info">
            {product.productType || 'Sparkling tonic'}
          </p>
          <ProductTitle>{title}</ProductTitle>
          {flavour && (
            <p className="pdp-notes" data-reveal="info">
              {flavour.notes}
            </p>
          )}
          <div data-reveal="info">
            <ProductBuyBox
              product={product}
              selectedVariant={selectedVariant}
              productOptions={productOptions}
              siblings={siblings}
            />
          </div>
          <div
            className="pdp-description"
            data-reveal="info"
            dangerouslySetInnerHTML={{__html: descriptionHtml}}
          />
        </div>
      </div>
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    productType
    tags
    featuredImage {
      id
      url
      altText
      width
      height
    }
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

const FLAVOUR_SIBLINGS_QUERY = `#graphql
  query FlavourSiblings(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      products(first: 12) {
        nodes {
          id
          handle
          title
          tags
        }
      }
    }
  }
` as const;
