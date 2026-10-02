import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/_index';
import {pageMeta} from '~/lib/seo';
import {Suspense} from 'react';
import {Image} from '@shopify/hydrogen';
import {ArrowRight} from 'lucide-react';
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import {ProductCard, PRODUCT_CARD_FRAGMENT} from '~/components/product/ProductCard';
import {ProductGrid} from '~/components/product/ProductGrid';
import {byFlavourOrder} from '~/lib/flavours';
import {MockShopNotice} from '~/components/MockShopNotice';
import {ParallaxStage} from '~/components/home/ParallaxStage';
import {Hero} from '~/components/home/Hero';
import {Benefits} from '~/components/home/Benefits';

export const meta: Route.MetaFunction = (args) => pageMeta(args);

/**
 * The drinks collection the homepage features (Shopify admin > Products >
 * Collections). The homepage shows only this collection: no "latest products"
 * fallback, so nothing else in the store can ever surface here.
 */
const FEATURED_COLLECTION_HANDLE = 'sparkling-tonics';

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
async function loadCriticalData({context}: Route.LoaderArgs) {
  const [{collection}] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY, {
      variables: {handle: FEATURED_COLLECTION_HANDLE},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
    featuredCollection: collection,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY, {
      variables: {handle: FEATURED_COLLECTION_HANDLE},
    })
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  return {
    recommendedProducts,
  };
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home" data-entrance data-morph-page>
      {data.isShopLinked ? null : <MockShopNotice />}
      <ParallaxStage>
        <Hero />
        <Benefits />
      </ParallaxStage>
      <div className="home-shelf">
        <FeaturedCollection collection={data.featuredCollection} />
        <RecommendedProducts products={data.recommendedProducts} />
      </div>
    </div>
  );
}

function FeaturedCollection({
  collection,
}: {
  collection?: FeaturedCollectionFragment | null;
}) {
  if (!collection) return null;
  const image = collection?.image;
  return (
    <Link
      className="featured-collection"
      to={`/collections/${collection.handle}`}
    >
      {image && (
        <div className="featured-collection-image">
          <Image
            data={image}
            sizes="(min-width: 45em) 50vw, 100vw"
            alt={image.altText || collection.title}
          />
        </div>
      )}
      <div>
        <p className="sf-eyebrow">Featured collection</p>
        <h2>{collection.title}</h2>
      </div>
      <span className="featured-collection-cta">
        Shop the collection <ArrowRight aria-hidden size={18} />
      </span>
    </Link>
  );
}

function RecommendedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  return (
    <section
      className="recommended-products"
      aria-labelledby="recommended-products"
    >
      <p className="sf-eyebrow">The lineup</p>
      <h2 id="recommended-products">Pick your flavour</h2>
      <Suspense fallback={<p className="sf-loading">Pouring the lineup…</p>}>
        <Await resolve={products}>
          {(response) => (
            // Same card, hover pour, cursor label, entrance and card → page morph as the listing.
            <ProductGrid className="home-grid">
              <div className="recommended-products-grid">
                {byFlavourOrder(response?.collection?.products.nodes ?? []).map((product) => (
                  <ProductCard key={product.id} product={product} headingLevel={3} />
                ))}
              </div>
            </ProductGrid>
          )}
        </Await>
      </Suspense>
      <br />
    </section>
  );
}

const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
  }
  query FeaturedCollection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      ...FeaturedCollection
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  query RecommendedProducts(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      products(first: 8) {
        nodes {
          ...ProductCard
        }
      }
    }
  }
` as const;
