import {Analytics, getShopAnalytics, useNonce} from '@shopify/hydrogen';
import {
  Outlet,
  useRouteError,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import type {Route} from './+types/root';
import favicon from '~/assets/favicon.svg';
import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import siteStyles from '~/styles/site.css?url';
import fredokaLatin from '@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2?url';
import {PageLayout} from './components/PageLayout';
import {SmoothScroll} from '~/components/motion/SmoothScroll';
import {CustomCursor} from '~/components/motion/CustomCursor';
import {PourOverlay} from '~/components/motion/PourOverlay';
import {Preloader, PRELOAD_FLAG_SCRIPT} from '~/components/motion/Preloader';
import {RouteTransitions} from '~/components/motion/RouteTransitions';
import {Magnetic} from '~/components/motion/Magnetic';
import {Scramble} from '~/components/motion/Scramble';
import {ScrollProgress} from '~/components/motion/ScrollProgress';
import {ErrorPage} from '~/components/ErrorPage';
import {pageMeta} from '~/lib/seo';

export type RootLoader = typeof loader;

/** Fallback tags for routes without their own meta, and for error pages. */
export const meta: Route.MetaFunction = (args) => {
  const {error} = args;
  if (error) {
    const notFound = isRouteErrorResponse(error) && error.status === 404;
    return pageMeta(args, {
      title: notFound ? 'Page not found' : 'Something went flat',
      description: notFound
        ? "We couldn't find that page. Browse the Sunfizz range of sparkling prebiotic tonics instead."
        : undefined,
    });
  }
  return pageMeta(args);
};

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') return true;

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) return true;

  // Defaulting to no revalidation for root loader data to improve performance.
  // When using this feature, you risk your UI getting out of sync with your server.
  // Use with caution. If you are uncomfortable with this optimization, update the
  // line below to `return defaultShouldRevalidate` instead.
  // For more details see: https://remix.run/docs/en/main/route/should-revalidate
  return false;
};

/**
 * The main and reset stylesheets are added in the Layout component
 * to prevent a bug in development HMR updates.
 *
 * This avoids the "failed to execute 'insertBefore' on 'Node'" error
 * that occurs after editing and navigating to another page.
 *
 * It's a temporary fix until the issue is resolved.
 * https://github.com/remix-run/remix/issues/9242
 */
export function links() {
  return [
    {
      rel: 'preconnect',
      href: 'https://cdn.shopify.com',
    },
    {
      rel: 'preconnect',
      href: 'https://shop.app',
    },
    {rel: 'icon', type: 'image/svg+xml', href: favicon},
  ];
}

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const {storefront, env} = args.context;

  return {
    ...deferredData,
    ...criticalData,
    // For absolute canonical / og:url tags (lib/seo.ts), wherever the site is hosted.
    origin: new URL(args.request.url).origin,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    consent: {
      checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      withPrivacyBanner: false,
      // localize the privacy banner
      country: args.context.storefront.i18n.country,
      language: args.context.storefront.i18n.language,
    },
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: Route.LoaderArgs) {
  const {storefront} = context;

  const [header] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: 'main-menu', // Adjust to your header menu handle
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {header};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const {storefront, customerAccount, cart} = context;

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        footerMenuHandle: 'footer', // Adjust to your footer menu handle
      },
    })
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });
  return {
    cart: cart.get(),
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export function Layout({children}: {children?: React.ReactNode}) {
  const nonce = useNonce();

  return (
    // suppressHydrationWarning: the inline script below adds a class before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {/* Flags JS before first paint so load-reveal elements can start hidden (theme.css). */}
        {/* Also marks a session's first load for the preloader (components/motion/Preloader). */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{__html: PRELOAD_FLAG_SCRIPT}}
        />
        {/* One bundled stylesheet (styles/site.css @imports the rest). */}
        <link rel="stylesheet" href={siteStyles}></link>
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href={fredokaLatin}
          crossOrigin="anonymous"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <PourOverlay />
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

/**
 * Everything around a page: analytics, the site-wide motion layer (smooth
 * scroll, cursor, preloader, page transitions, magnetic pull, scramble, scroll
 * progress) and the header/footer/drawers. Error pages get the same shell.
 */
function Shell({
  data,
  children,
}: {
  data: NonNullable<ReturnType<typeof useRouteLoaderData<RootLoader>>>;
  children: React.ReactNode;
}) {
  return (
    <Analytics.Provider
      cart={data.cart}
      shop={data.shop}
      consent={data.consent}
    >
      <SmoothScroll />
      <CustomCursor />
      <Preloader />
      <RouteTransitions />
      <Magnetic />
      <Scramble />
      <ScrollProgress />
      <PageLayout {...data}>{children}</PageLayout>
    </Analytics.Provider>
  );
}

export default function App() {
  const data = useRouteLoaderData<RootLoader>('root');

  if (!data) {
    return <Outlet />;
  }

  return (
    <Shell data={data}>
      <Outlet />
    </Shell>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const data = useRouteLoaderData<RootLoader>('root');
  let errorMessage = 'Unknown error';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error?.data?.message ?? error.data;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  const page = <ErrorPage status={errorStatus} message={errorMessage} />;
  // The root loader worked (the error came from a page): keep the whole site around it.
  return data ? <Shell data={data}>{page}</Shell> : page;
}
