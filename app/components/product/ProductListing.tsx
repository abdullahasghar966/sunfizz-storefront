import {useEffect, useRef, type ReactNode} from 'react';
import {DUR, EASE, gsap, MOTION_OK, STAGGER} from '~/lib/motion';
import {stageReady} from '~/lib/stage';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {FizzBackdrop} from '~/components/product/FizzBackdrop';
import {ProductCard} from '~/components/product/ProductCard';
import {ProductGrid} from '~/components/product/ProductGrid';
import type {ProductCardFragment} from 'storefrontapi.generated';

type Connection = React.ComponentProps<
  typeof PaginatedResourceSection<ProductCardFragment>
>['connection'];

/**
 * Branded product listing: header over a fizz backdrop, then the card grid.
 * Used by /collections/all and /collections/:handle.
 */
export function ProductListing({
  eyebrow,
  title,
  intro,
  products,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  products: Connection;
  children?: ReactNode;
}) {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, (context) => {
      let cancelled = false;
      header.dataset.motion = 'on';
      const parts = gsap.utils.toArray<HTMLElement>('[data-reveal]', header);
      gsap.set(parts, {autoAlpha: 0});
      // Plays as the page is revealed (after the preloader or a page wipe).
      void stageReady().then(() => {
        if (cancelled) return;
        context.add(() => {
          gsap.fromTo(
            parts,
            {autoAlpha: 0, y: 28},
            {
              autoAlpha: 1,
              y: 0,
              duration: DUR.slow,
              ease: EASE.out,
              stagger: STAGGER.items,
              delay: 0.05,
            },
          );
        });
      });
      return () => {
        cancelled = true;
        delete header.dataset.motion;
      };
    });
    return () => mm.revert();
  }, []);

  return (
    <div className="plp" data-morph-page data-entrance>
      <section className="plp-hero" ref={headerRef}>
        <FizzBackdrop />
        <div className="plp-hero-copy">
          <p className="sf-eyebrow" data-reveal="plp">
            {eyebrow}
          </p>
          <h1 className="plp-title" data-reveal="plp">
            {title}
          </h1>
          {intro && (
            <div className="plp-intro" data-reveal="plp">
              {intro}
            </div>
          )}
        </div>
      </section>
      <ProductGrid>
        <PaginatedResourceSection<ProductCardFragment>
          connection={products}
          resourcesClassName="plp-grid"
        >
          {({node: product, index}) => (
            <ProductCard
              key={product.id}
              product={product}
              loading={index < 6 ? 'eager' : undefined}
            />
          )}
        </PaginatedResourceSection>
      </ProductGrid>
      {children}
    </div>
  );
}
