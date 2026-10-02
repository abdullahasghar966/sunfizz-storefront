# Sunfizz: a hyper-animated Shopify storefront

A heavily animated headless storefront for **Sunfizz**, a fictional sparkling prebiotic tonic in
four citrus flavours plus a variety pack. It runs on **Shopify Hydrogen** (React Router 7, SSR)
against a Shopify dev store through the **Storefront API**, and hands off to Shopify's own
hosted checkout.

The motion is **GSAP** (ScrollTrigger, SplitText, ScrambleText), **Lenis** smooth scroll, a
**React Three Fiber** 3D can and a small canvas mini-game. Everything respects
`prefers-reduced-motion`, and pointer effects only run with a real mouse.

**Live site: https://sunfizz-six.vercel.app**

## What's in it

- **Homepage:** a SplitText hero with a bobbing can, a 4-layer scroll parallax with ambient
  float loops, a benefits section and the flavour lineup.
- **Listing:** product cards that cross-fade from the can to a poured glass on hover (on touch,
  while centred on screen), a scroll-triggered entrance and a "View" cursor.
- **Product page:** a SplitText title; a 3D can that loads on first interaction; floating
  ingredient callouts; flavour swatches; pack-size variants; an add-to-cart pulse. The card image
  morphs into the product page.
- **Cart:** a GSAP drawer with a focus trap, animated line items, odometer quantities, count-up
  totals, an empty-glass state and a liquid "pour" into Shopify's checkout.
- **Site-wide:**
  - a liquid page transition on every route;
  - a first-visit preloader that hands off to the hero;
  - magnetic buttons and scrambling nav links;
  - a scroll progress bar and one focus ring;
  - SEO meta, Open Graph and Product JSON-LD;
  - a branded 404 page.
- **Footer easter egg, "Fizz Dash":** a canvas endless runner. The can hops ice cubes, straws
  and lemon wheels and collects bubbles. Its code loads only when the footer comes near, and it
  runs only after a click, tap or key press on it.

## Stack

| | |
|---|---|
| Framework | Hydrogen 2026.4, React Router 7.16, React 18.3, Vite 8, TypeScript |
| Motion | gsap 3.15, lenis 1.3, three 0.186 + @react-three/fiber 8.18 |
| UI | lucide-react icons, Fredoka Variable (self-hosted) |
| Commerce | Shopify Storefront API, Shopify hosted checkout |
| Hosting | Vercel Edge runtime (public); also Shopify Oxygen (private on a dev store). See Deploying |

## Running it locally

Requirements: **Node.js 22 or 24**.

1. Create `.env` in the project root (it's git-ignored; never commit it):

   | Variable | What it is | Where it comes from |
   |---|---|---|
   | `PUBLIC_STORE_DOMAIN` | the store's `*.myshopify.com` domain | Shopify admin → Settings → Domains |
   | `PUBLIC_STOREFRONT_API_TOKEN` | a **public** Storefront API access token | Shopify admin → Sales channels → Headless → your storefront → Storefront API → Manage |
   | `PUBLIC_CHECKOUT_DOMAIN` | where checkout runs (here the same myshopify domain) | as above |
   | `SESSION_SECRET` | signs the session cookie | any long random string |

2. Install and start:

   ```bash
   npm install
   ```

   ```bash
   npm run dev
   ```

   The dev server runs at http://localhost:3000.

| Script | What it does |
|---|---|
| `npm run dev` | dev server with GraphQL codegen |
| `npm run build` | production build |
| `npm run preview` | build, then serve the production bundle locally |
| `npm run typecheck` | route type generation + `tsc` |
| `npm run lint` | ESLint |
| `npm run codegen` | regenerate the Storefront API types |

End-to-end and performance checks (puppeteer + Lighthouse) live in
[scripts/qa](scripts/qa/README.md).

## How the Shopify connection works

- **Channel:** the storefront reads the store through a **Headless** sales channel storefront.
  Its public Storefront API token is read-only and safe to expose to browsers. No Admin API
  token and no private token are used. The optional `PRIVATE_STOREFRONT_API_TOKEN` is not set.
- **Catalog:** 5 products, each tagged with its flavour (`orange`, `grapefruit`, `lemon`,
  `lime`, `variety`) and the tag `sunfizz`. The tags drive the colour palette and copy in
  `app/lib/flavours.ts`. The homepage shows only the automated collection
  **`sparkling-tonics`** (tag = `sunfizz`). Product images: the can packshot first, the poured
  glass second (hover image). The import CSV and images are in `catalog/`.
- **Checkout:** Shopify's hosted checkout on the myshopify domain. A dev store always has a
  storefront password, so checkout passes through the password page. Test orders use
  Shopify's **Test payment gateway**.
- **Money:** prices render through `app/components/Money.tsx`, which pins the decimals so the
  server and browser print identical text (no hydration mismatch).
- **Not set up:** customer accounts (the `/account` routes need the Customer Account API; see
  <https://shopify.dev/docs/custom-storefronts/building-with-the-customer-account-api/hydrogen>).

## Where things live

```
app/
  root.tsx                   document shell: preloader flag, pour overlay, motion systems, layout
  routes/                    Hydrogen routes (home, collections, products, cart, search, pages, 404…)
  components/
    motion/                  smooth scroll, cursor, pour overlay, preloader, route transitions,
                             magnetic, scramble, scroll progress
    home/                    hero, parallax stage, benefits
    product/                 listing, cards, product stage, 3D can (CanViewer), buy box
    cart/                    animated values, line motion, empty state
    game/                    FooterGame (lazy wrapper) + fizzDash (canvas engine, own chunk)
    Aside.tsx                the GSAP drawer (cart, search, menu)
    ErrorPage.tsx            branded 404 / error page
  lib/
    motion.ts                GSAP setup + motion tokens (EASE, DUR, STAGGER)
    stage.ts, pour.ts        entrance gate and the shared liquid overlay
    intent.ts                "load on first interaction or idle" (3D viewer)
    seo.ts                   site-wide SEO defaults + pageMeta()
    flavours.ts              flavour palette keyed by product tag
  styles/site.css            the single stylesheet (imports the others in order)
public/fx/                   decorative SVGs (the CSP blocks data: images)
catalog/                     product images, import CSV and the generator script
scripts/qa/                  regression, game, performance and Lighthouse scripts
scripts/deploy-vercel.mjs    package + deploy to Vercel (the live site)
scripts/deploy-cloudflare.mjs + wrangler.jsonc   deploy to Cloudflare Workers (alternative)
```

## Deploying

The production build (`npm run build`) is a web-standard worker module, so it runs unchanged
on Shopify Oxygen, Vercel's Edge runtime and Cloudflare Workers. All three read the same four
`.env` values; the scripts never print them.

### Vercel: the public live site (free Hobby plan)

Once per machine:

```bash
npx vercel@latest login
```

Then build and deploy:

```bash
node scripts/deploy-vercel.mjs
```

The script:
1. Builds the site.
2. Packages it in Vercel's Build Output format: `dist/client` as static files (hashed
   `/assets` cached for a year) and one Edge function that wraps the worker.
3. Links the `sunfizz` project on first run.
4. Adds any missing production variables: `PUBLIC_*` as config, `SESSION_SECRET` as a secret.
5. Deploys to production.

Vercel's Edge runtime has no Cache API, so the wrapper gives Hydrogen a no-op cache (pages fetch
from Shopify on every request).

### Shopify Oxygen: native, but private on a development store

On a free development store, Oxygen only allows **private** URLs (visible to staff accounts
of the store); public URLs need a paid Shopify plan. The Hydrogen storefront **Sunfizz** has the
private URL https://sunfizz-9e7751a21f3b064b7341.o2.myshopify.dev.

The link to it is **parked** as `.shopify/project.oxygen-link.json`. While
`.shopify/project.json` exists, `npm run dev` and `npm run preview` pull the storefront's variables
from Shopify and so need a Shopify CLI login. Parked, they use `.env` with no login.

To redeploy to Oxygen:
1. Rename the file back to `project.json`.
2. Run this in your own terminal (the Shopify CLI login is per terminal session):

```bash
npx shopify hydrogen deploy --env-file .env.oxygen --force --metadata-description "Sunfizz release"
```

3. Park the file again.

`.env.oxygen` (git-ignored) is `.env` plus blank `PRIVATE_STOREFRONT_API_TOKEN` and
`PUBLIC_STOREFRONT_ID`, so the deployment reads the catalog through the Headless channel exactly
like local development (otherwise the products would also need publishing to the Hydrogen
storefront's channel). `--force` is needed while the working tree has uncommitted changes.

### Cloudflare Workers: a tested alternative (free plan)

`wrangler.jsonc` serves `dist/client` as static assets and the worker for everything else.
Once per machine, log in:

```bash
npx --yes wrangler@4 login
```

Then build and deploy:

```bash
node scripts/deploy-cloudflare.mjs
```

The free plan allows 10 ms of CPU per request with some flexibility; warm page renders measured
4–8 ms.

Each deploy script builds first. An Oxygen deploy rewrites `dist` with Shopify CDN asset URLs, so
never package a `dist` left over from an Oxygen deploy for the other hosts.
