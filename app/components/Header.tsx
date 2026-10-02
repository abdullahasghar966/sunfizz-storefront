import {Suspense, useCallback, useEffect, useMemo, useRef} from 'react';
import {Await, NavLink, useAsyncValue} from 'react-router';
import {
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import {Menu, Search, ShoppingBag, UserRound} from 'lucide-react';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
}

type Viewport = 'desktop' | 'mobile';

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {shop, menu} = header;
  return (
    <header className="header">
      <NavLink className="header-logo" prefetch="intent" to="/" end>
        {shop.name}
      </NavLink>
      <HeaderMenu
        menu={menu}
        viewport="desktop"
        primaryDomainUrl={header.shop.primaryDomain.url}
        publicStoreDomain={publicStoreDomain}
      />
      <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
    </header>
  );
}

export function HeaderMenu({
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
}: {
  menu: HeaderProps['header']['menu'];
  primaryDomainUrl: HeaderProps['header']['shop']['primaryDomain']['url'];
  viewport: Viewport;
  publicStoreDomain: HeaderProps['publicStoreDomain'];
}) {
  const className = `header-menu-${viewport}`;
  const {close} = useAside();

  return (
    <nav className={className} role="navigation">
      {viewport === 'mobile' && (
        <NavLink end onClick={close} prefetch="intent" to="/">
          Home
        </NavLink>
      )}
      {(menu || FALLBACK_HEADER_MENU).items.map((item) => {
        if (!item.url) return null;

        // if the url is internal, we strip the domain
        const url =
          item.url.includes('myshopify.com') ||
          item.url.includes(publicStoreDomain) ||
          item.url.includes(primaryDomainUrl)
            ? new URL(item.url).pathname
            : item.url;
        return (
          <NavLink
            className="header-menu-item"
            end
            key={item.id}
            onClick={close}
            prefetch="intent"
            to={url}
            // Desktop nav: magnetic pull + scramble-on-hover (both mouse-only).
            data-magnetic={viewport === 'desktop' ? '0.3' : undefined}
          >
            {viewport === 'desktop' ? (
              <>
                <span className="sr-only">{item.title}</span>
                <span className="scramble" data-scramble data-text={item.title} aria-hidden="true">
                  {item.title}
                </span>
              </>
            ) : (
              item.title
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function HeaderCtas({
  isLoggedIn,
  cart,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart'>) {
  return (
    <nav className="header-ctas" role="navigation">
      <HeaderMenuMobileToggle />
      <NavLink className="header-icon-btn" prefetch="intent" to="/account">
        <UserRound aria-hidden />
        <span className="sr-only">
          <Suspense fallback="Sign in">
            <Await resolve={isLoggedIn} errorElement="Sign in">
              {(isLoggedIn) => (isLoggedIn ? 'Account' : 'Sign in')}
            </Await>
          </Suspense>
        </span>
      </NavLink>
      <SearchToggle />
      <CartToggle cart={cart} />
    </nav>
  );
}

function HeaderMenuMobileToggle() {
  const {open} = useAside();
  return (
    <button
      className="header-menu-mobile-toggle header-icon-btn reset"
      onClick={() => open('mobile')}
      aria-label="Open menu"
    >
      <Menu aria-hidden />
    </button>
  );
}

function SearchToggle() {
  const {open} = useAside();
  return (
    <button
      className="header-icon-btn reset"
      onClick={() => open('search')}
      aria-label="Search"
    >
      <Search aria-hidden />
    </button>
  );
}

function CartBadge({count, onOpen}: {count: number; onOpen: () => void}) {
  return (
    <a
      href="/cart"
      className="header-icon-btn"
      aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
      onClick={(e) => {
        e.preventDefault();
        onOpen();
      }}
    >
      <ShoppingBag aria-hidden />
      {count > 0 && (
        <span className="header-cart-count" aria-hidden="true">
          {count}
        </span>
      )}
    </a>
  );
}

/**
 * The cart badge streams in inside a Suspense boundary. Analytics and drawer
 * state are read here, outside it, and handed down as one stable callback, and
 * the boundary itself is memoised: Hydrogen's analytics state settles while
 * the page hydrates, and an update reaching a still-hydrating boundary made
 * React throw "This Suspense boundary received an update before it finished
 * hydrating". Clicking still opens the drawer and publishes cart_viewed.
 */
function CartToggle({cart}: Pick<HeaderProps, 'cart'>) {
  const {open} = useAside();
  const analytics = useAnalytics();
  const latest = useRef({open, analytics});
  useEffect(() => {
    latest.current = {open, analytics};
  });

  const onOpen = useCallback(() => {
    const {open: openAside, analytics: a} = latest.current;
    openAside('cart');
    a.publish('cart_viewed', {
      cart: a.cart,
      prevCart: a.prevCart,
      shop: a.shop,
      url: window.location.href || '',
    } as CartViewPayload);
  }, []);

  return useMemo(
    () => (
      <Suspense fallback={<CartBadge count={0} onOpen={onOpen} />}>
        {/* If the cart request fails, keep the header working with an empty bag. */}
        <Await resolve={cart} errorElement={<CartBadge count={0} onOpen={onOpen} />}>
          <CartBanner onOpen={onOpen} />
        </Await>
      </Suspense>
    ),
    [cart, onOpen],
  );
}

function CartBanner({onOpen}: {onOpen: () => void}) {
  const originalCart = useAsyncValue() as CartApiQueryFragment | null;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} onOpen={onOpen} />;
}

const FALLBACK_HEADER_MENU = {
  id: 'gid://shopify/Menu/199655587896',
  items: [
    {
      id: 'gid://shopify/MenuItem/461609500728',
      resourceId: null,
      tags: [],
      title: 'Collections',
      type: 'HTTP',
      url: '/collections',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609533496',
      resourceId: null,
      tags: [],
      title: 'Blog',
      type: 'HTTP',
      url: '/blogs/journal',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609566264',
      resourceId: null,
      tags: [],
      title: 'Policies',
      type: 'HTTP',
      url: '/policies',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609599032',
      resourceId: 'gid://shopify/Page/92591030328',
      tags: [],
      title: 'About',
      type: 'PAGE',
      url: '/pages/about',
      items: [],
    },
  ],
};
