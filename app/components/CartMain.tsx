import {useRef} from 'react';
import {useOptimisticCart} from '@shopify/hydrogen';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import {CartLineItem, type CartLine} from '~/components/CartLineItem';
import {CartEmpty} from '~/components/cart/CartEmpty';
import {useCartLineMotion} from '~/components/cart/useCartLineMotion';
import {usePresence} from '~/lib/usePresence';
import {CartSummary} from './CartSummary';

export type CartLayout = 'page' | 'aside';

export type CartMainProps = {
  cart: CartApiQueryFragment | null;
  layout: CartLayout;
};

export type LineItemChildrenMap = {[parentId: string]: CartLine[]};
/** Returns a map of all line items and their children. */
function getLineItemChildrenMap(lines: CartLine[]): LineItemChildrenMap {
  const children: LineItemChildrenMap = {};
  for (const line of lines) {
    if ('parentRelationship' in line && line.parentRelationship?.parent) {
      const parentId = line.parentRelationship.parent.id;
      if (!children[parentId]) children[parentId] = [];
      children[parentId].push(line);
    }
    if ('lineComponents' in line) {
      const lineChildren = getLineItemChildrenMap(line.lineComponents);
      for (const [parentId, childIds] of Object.entries(lineChildren)) {
        if (!children[parentId]) children[parentId] = [];
        children[parentId].push(...childIds);
      }
    }
  }
  return children;
}
/**
 * The main cart component that displays the cart items and summary.
 * It is used by both the /cart route and the cart aside dialog.
 */
export function CartMain({layout, cart: originalCart}: CartMainProps) {
  // The useOptimisticCart hook applies pending actions to the cart
  // so the user immediately sees feedback when they modify the cart.
  const cart = useOptimisticCart(originalCart);
  const {type, close} = useAside();
  const listRef = useRef<HTMLUListElement>(null);

  const withDiscount =
    cart &&
    Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);
  const className = `cart-main ${withDiscount ? 'with-discount' : ''}`;
  const cartHasItems = cart?.totalQuantity ? cart.totalQuantity > 0 : false;
  const childrenMap = getLineItemChildrenMap(cart?.lines?.nodes ?? []);

  // We do not render non-parent lines at the root of the cart.
  const rootLines = (cart?.lines?.nodes ?? []).filter(
    (line) => !('parentRelationship' in line && line.parentRelationship?.parent),
  );
  // Keyed by variant, not line id: an optimistic line and the server's real line
  // for the same variant are the same row, so it doesn't animate in twice.
  const [presence, done] = usePresence(rootLines, (line) => line.merchandise.id);
  useCartLineMotion({
    listRef,
    presence,
    done,
    layout,
    drawerOpen: layout === 'aside' && type === 'cart',
  });

  return (
    <section
      className={className}
      aria-label={layout === 'page' ? 'Cart page' : 'Cart drawer'}
    >
      {/* Waits for the last line's exit animation before it appears. */}
      <CartEmpty
        hidden={presence.length > 0}
        active={layout === 'page' || type === 'cart'}
        onBrowse={layout === 'aside' ? close : undefined}
      />
      <div className="cart-details">
        <p id="cart-lines" className="sr-only">
          Line items
        </p>
        <div className="cart-lines-scroll">
          <ul aria-labelledby="cart-lines" className="cart-lines" ref={listRef}>
            {presence.map(({key, item: line, exiting}) => (
              <CartLineItem
                key={key}
                presenceKey={key}
                exiting={exiting}
                line={line}
                layout={layout}
                childrenMap={childrenMap}
              />
            ))}
          </ul>
        </div>
        {/* Stays while the last line collapses, fading out with it. */}
        {(cartHasItems || presence.length > 0) && (
          <div
            className="cart-summary-wrap"
            data-leaving={!cartHasItems || undefined}
          >
            <CartSummary cart={cart} layout={layout} />
          </div>
        )}
      </div>
    </section>
  );
}
