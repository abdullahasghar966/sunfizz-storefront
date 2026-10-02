import {getSeoMeta, type SeoConfig} from '@shopify/hydrogen';

/**
 * Site-wide SEO defaults (Hydrogen's getSeoMeta turns these into <title>,
 * description, canonical, Open Graph and Twitter tags). Pages override
 * title / description / media via pageMeta().
 */
export const SITE_SEO: SeoConfig = {
  title: 'Sip the sunshine',
  titleTemplate: 'Sunfizz | %s',
  // Under 160 characters (Hydrogen validates it; search results cut longer ones).
  description:
    'Sparkling prebiotic tonics with real cold-pressed citrus juice, 9g of plant fibre and just 5g of sugar per can. Four flavours, one sunny fizz.',
  media: {
    type: 'image',
    url: 'https://cdn.shopify.com/s/files/1/0984/3087/7969/files/sunfizz-variety-pack.png?width=1200',
    width: 1200,
    height: 1200,
    altText: 'Four cans of Sunfizz sparkling tonic: Citrus Sunrise, Pink Grapefruit Glow, Lemon Zest and Lime Crush',
  },
};

type MetaMatch = {id: string; data?: unknown} | undefined;

/**
 * Meta tags for a page: site defaults + the page's own SEO, with an absolute
 * canonical / og:url built from the request origin the root loader exposes.
 */
export function pageMeta(
  {matches, location}: {matches: MetaMatch[]; location: {pathname: string}},
  page: SeoConfig = {},
) {
  const root = matches.find((match) => match?.id === 'root')?.data as
    | {origin?: string}
    | undefined;
  const url = root?.origin ? `${root.origin}${location.pathname}` : undefined;
  return getSeoMeta(SITE_SEO, {url, ...page}) ?? [];
}

/** Search engines show ~155 characters of a description. */
export function clip(text: string | null | undefined, max = 155) {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
