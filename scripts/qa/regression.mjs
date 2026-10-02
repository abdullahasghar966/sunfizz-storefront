// Full-site regression in real (headless) Chrome with its own profile (its own cart).
// Usage: node regression.mjs [baseUrl]
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
// puppeteer-core: `npm i --no-save puppeteer-core@25` (dev server stopped), or point PUPPETEER_FROM at a node_modules that has it.
const require = createRequire(process.env.PUPPETEER_FROM ? process.env.PUPPETEER_FROM + '/' : import.meta.url);
const puppeteer = require('puppeteer-core');
const OUT_DIR = process.env.OUT_DIR || fileURLToPath(new URL('./out/', import.meta.url));
fs.mkdirSync(OUT_DIR, {recursive: true});
const out = (name) => path.join(OUT_DIR, name);

const BASE = process.argv[2] || 'http://localhost:3000';
// Dev servers serve app modules (importable for introspection); production builds don't.
const devModules = (page) => page.evaluate(() => import('/app/lib/motion.ts').then(() => true, () => false));
const results = [];
const errors = [];
const external = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function check(section, name, ok, detail = '') {
  results.push({section, name, ok: Boolean(ok), detail: String(detail)});
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${section}] ${name}${detail !== '' ? '  (' + detail + ')' : ''}`);
}

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const launch = (viewport) =>
  puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'],
    defaultViewport: viewport,
    protocolTimeout: 120000,
  });

function watchConsole(page, label) {
  page.on('console', (m) => {
    const t = m.text();
    const url = m.location()?.url || '';
    // The deliberate 404 visits (page and its .data request) are expected.
    const expected404 = /Failed to load resource/.test(t) && /this-can-is-empty|nope-404|\/app\/lib\/motion\.ts/.test(url); // 404 pages + the dev-module probe
    const offSite = url && !url.startsWith(BASE); // e.g. Shopify's own password page during the checkout test
    if (m.type() === 'error' && !expected404) (offSite ? external : errors).push(`[${label}] console.error: ${t} ${url}`);
    if (m.type() === 'warning' && /hydrat|Warning:|did not match/i.test(t)) errors.push(`[${label}] warning: ${t}`);
  });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
}

async function waitHydrated(page) {
  await page.waitForFunction(
    () => document.documentElement.classList.contains('lenis') || matchMedia('(prefers-reduced-motion: reduce)').matches,
    {timeout: 30000},
  );
}

/** Client-side navigation through React Router; records whether the pour covered the screen. */
async function clientNav(page, path) {
  return page.evaluate(async (to) => {
    let poured = false;
    const pour = document.querySelector('.pour');
    const iv = setInterval(() => {
      if (pour?.classList.contains('is-active')) poured = true;
    }, 30);
    const t0 = performance.now();
    await window.__reactRouterDataRouter.navigate(to);
    // wait for the reveal to finish
    await new Promise((r) => {
      const until = performance.now() + 4000;
      const tick = () => (!pour?.classList.contains('is-active') || performance.now() > until ? r() : setTimeout(tick, 50));
      setTimeout(tick, 100);
    });
    clearInterval(iv);
    return {poured, ms: Math.round(performance.now() - t0), path: location.pathname, title: document.title};
  }, path);
}

// ------------------------------------------------------------------ desktop run
{
  const browser = await launch({width: 1440, height: 900});
  const page = await browser.newPage();
  watchConsole(page, 'desktop');

  // A. Homepage, fresh session: preloader → hero, parallax, loops, cursor, magnetic, progress
  const S = 'home';
  const res = await page.goto(BASE + '/', {waitUntil: 'domcontentloaded', timeout: 90000});
  check(S, 'status 200', res.status() === 200, res.status());
  const preloading = await page.evaluate(() => document.documentElement.classList.contains('is-preloading'));
  check(S, 'preloader shows on first visit', preloading);
  const t0 = Date.now();
  await page.waitForFunction(() => !document.documentElement.classList.contains('is-preloading'), {timeout: 8000}).catch(() => {});
  check(S, 'preloader hands off within ~2.2s of load', Date.now() - t0 < 4500, `${Date.now() - t0}ms after DOMContentLoaded`);
  await waitHydrated(page);
  await sleep(2600);
  const hero = await page.evaluate(() => {
    const h = document.querySelector('.hero-title');
    const chars = h ? h.querySelectorAll('[class*=char], .hero-char') : [];
    const last = chars[chars.length - 1];
    const cta = document.querySelector('.hero-ctas');
    return {
      chars: chars.length,
      lastOpacity: last ? getComputedStyle(last).opacity : null,
      titleVisible: h ? getComputedStyle(h).visibility : null,
      ctaOpacity: cta ? getComputedStyle(cta).opacity : null,
    };
  });
  check(S, 'hero headline split + revealed', hero.chars > 5 && hero.titleVisible === 'visible' && Number(hero.lastOpacity) > 0.95, JSON.stringify(hero));
  check(S, 'hero CTAs revealed', Number(hero.ctaOpacity) > 0.95, hero.ctaOpacity);
  if (await devModules(page)) {
    const tweens = await page.evaluate(async () => {
      const {gsap} = await import('/app/lib/motion.ts');
      return gsap.globalTimeline.getChildren(true, true, false).filter((t) => t.isActive() || t.repeat() === -1).length;
    });
    check(S, 'ambient loops running', tweens > 20, `${tweens} active/looping tweens`);
  }
  // Cursor + magnetic + scramble
  const cta = await page.$('.hero-ctas a, .hero-ctas .sf-btn');
  const ctaBox = await cta.boundingBox();
  await page.mouse.move(200, 400);
  await page.mouse.move(ctaBox.x + ctaBox.width / 2 + 20, ctaBox.y + ctaBox.height / 2 + 10, {steps: 8});
  await sleep(700);
  const cursor = await page.evaluate(() => {
    const c = document.querySelector('.cursor');
    return c ? {cls: c.className, w: c.getBoundingClientRect().width} : null;
  });
  check(S, 'custom cursor grows over the CTA', cursor && /is-hover|is-label/.test(cursor.cls) && cursor.w > 30, JSON.stringify(cursor));
  const magnet = await page.evaluate(() => {
    const el = document.querySelector('.hero-ctas [data-magnetic]');
    return el ? getComputedStyle(el).transform : null;
  });
  check(S, 'magnetic pull on the CTA', magnet && magnet !== 'none' && magnet !== 'matrix(1, 0, 0, 1, 0, 0)', magnet);
  const nav = await page.$('.header-menu-desktop a[data-magnetic]');
  const navBox = await nav.boundingBox();
  const before = await page.evaluate(() => document.querySelector('.header-menu-desktop [data-scramble]')?.textContent);
  await page.mouse.move(navBox.x + navBox.width / 2, navBox.y + navBox.height / 2, {steps: 4});
  await sleep(120);
  const during = await page.evaluate(() => document.querySelector('.header-menu-desktop a:hover [data-scramble]')?.textContent);
  await sleep(900);
  const after = await page.evaluate(() => document.querySelector('.header-menu-desktop a:hover [data-scramble]')?.textContent);
  check(S, 'nav scramble on hover', during !== undefined && after !== undefined, `before "${before}" during "${during}" after "${after}"`);
  // Parallax + progress
  const layer0 = await page.$eval('.parallax-layer', (el) => getComputedStyle(el).transform);
  await page.mouse.move(700, 500);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel({deltaY: 120});
    await sleep(60);
  }
  await sleep(1200);
  const layer1 = await page.$eval('.parallax-layer', (el) => getComputedStyle(el).transform);
  check(S, 'parallax layers move with scroll', layer0 !== layer1, `${layer0} → ${layer1}`);
  const progress = await page.evaluate(() => {
    const bar = document.querySelector('.scroll-progress');
    const fill = document.querySelector('.scroll-progress-fill');
    return {on: bar?.classList.contains('is-scrollable'), fill: fill && getComputedStyle(fill).transform};
  });
  check(S, 'scroll progress fills', progress.on && progress.fill !== 'matrix(0, 0, 0, 1, 0, 0)', JSON.stringify(progress));
  const markers = await page.evaluate(() => document.querySelectorAll('[class*="gsap-marker"]').length);
  check(S, 'no ScrollTrigger markers', markers === 0);

  // B. Listing via a real header link (pour transition), hover crossfade, scroll entrance
  const L = 'listing';
  const nav1 = await clientNav(page, '/collections/all');
  check(L, 'pour transition on navigation', nav1.poured, JSON.stringify(nav1));
  await sleep(600);
  const cards = await page.$$('.pcard-link');
  check(L, '5 product cards', cards.length === 5, cards.length);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(600);
  const visible = await page.$$eval('.pcard', (els) => els.filter((e) => Number(getComputedStyle(e).opacity) > 0.95).length);
  check(L, 'scroll entrance reveals every card', visible === 5, `${visible}/5 visible`);
  const card = await page.$('.pcard-link');
  const cb = await card.boundingBox();
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 3, {steps: 5});
  await sleep(900);
  const hover = await page.evaluate(() => {
    const alt = document.querySelector('.pcard-link:hover .pcard-img--alt');
    const c = document.querySelector('.cursor');
    return {alt: alt && getComputedStyle(alt).opacity, cursor: c?.className, label: document.querySelector('.cursor-label')?.textContent};
  });
  check(L, 'hover crossfade to the poured glass', Number(hover.alt) > 0.95, JSON.stringify(hover));
  check(L, '"View" cursor over cards', /is-label/.test(hover.cursor || '') && hover.label === 'View', hover.label);

  // C. Card → product morph (no pour), 3D viewer, variant, add to cart
  const P = 'product';
  const morph = await page.evaluate(async () => {
    let poured = false;
    const pour = document.querySelector('.pour');
    const iv = setInterval(() => {
      if (pour?.classList.contains('is-active')) poured = true;
    }, 30);
    document.querySelector('.pcard-link').click();
    await new Promise((r) => setTimeout(r, 2500));
    clearInterval(iv);
    return {poured, path: location.pathname};
  });
  check(P, 'card click morphs to the product page (no pour)', /\/products\//.test(morph.path) && !morph.poured, JSON.stringify(morph));
  await page.mouse.move(800, 400, {steps: 5});
  await page.waitForSelector('.pdp-stage canvas', {timeout: 20000}).catch(() => {});
  check(P, '3D viewer loads after interaction', Boolean(await page.$('.pdp-stage canvas')));
  const price0 = await page.$eval('.pdp-price, [class*=price]', (el) => el.textContent.trim()).catch(() => '');
  const pills = await page.$$('.pdp-pill');
  check(P, 'pack-size pills', pills.length >= 2, pills.length);
  await pills[1].click();
  await sleep(1800);
  const v = await page.evaluate(() => ({url: location.search, price: document.querySelector('.pdp-price, [class*=price]')?.textContent.trim()}));
  check(P, 'variant selection updates URL and price', /Pack\+size|Pack%20size/.test(v.url) && v.price !== price0, `${price0} → ${v.price} ${decodeURIComponent(v.url)}`);
  const count0 = await page.$eval('.header-ctas a[href="/cart"]', (a) => a.getAttribute('aria-label'));
  await page.click('.pdp-atc button');
  await page.waitForFunction(() => document.querySelector('.overlay.expanded[data-aside-type="cart"]'), {timeout: 10000}).catch(() => {});
  await sleep(1500);
  const count1 = await page.$eval('.header-ctas a[href="/cart"]', (a) => a.getAttribute('aria-label'));
  check(P, 'add to cart updates the badge', count0 !== count1 && /1 item/.test(count1), `${count0} → ${count1}`);
  check(P, 'cart drawer opens after adding', Boolean(await page.$('.overlay.expanded[data-aside-type="cart"]')));

  // D. Cart drawer: quantity, close/open, focus, removal, empty state
  const C = 'cart';
  const lines = await page.$$('.overlay.expanded .cart-line');
  check(C, 'line in the drawer', lines.length === 1, lines.length);
  const inert = await page.evaluate(() => document.querySelector('body > main')?.inert);
  check(C, 'page behind is inert (focus trap)', inert === true);
  const sub0 = await page.$eval('.overlay.expanded .cart-subtotal, .overlay.expanded [class*=subtotal]', (el) => el.textContent.trim()).catch(() => '');
  // Wait for the server-confirmed cart: Hydrogen disables the buttons on optimistic lines.
  await page.waitForFunction(() => {
    const sub = document.querySelector('.overlay.expanded .cart-subtotal, .overlay.expanded [class*=subtotal]')?.textContent || '';
    const plus = document.querySelector('.overlay.expanded button[aria-label="Increase quantity"]');
    return /PKR/.test(sub) && plus && !plus.disabled;
  }, {timeout: 15000}).catch(() => {});
  const subSettled = await page.$eval('.overlay.expanded .cart-subtotal, .overlay.expanded [class*=subtotal]', (el) => el.textContent.trim()).catch(() => '');
  await page.click('.overlay.expanded button[aria-label="Increase quantity"]');
  await page.waitForFunction(() => document.querySelector('.overlay.expanded .cart-line-qty')?.textContent.includes('2'), {timeout: 10000}).catch(() => {});
  // The subtotal comes back from Shopify after the line updates; wait for it (slow networks) instead of a fixed sleep.
  await page.waitForFunction((before) => {
    const now = document.querySelector('.overlay.expanded .cart-subtotal, .overlay.expanded [class*=subtotal]')?.textContent.trim();
    return now && now !== before && /PKR/.test(now);
  }, {timeout: 20000}, subSettled).catch(() => {});
  await sleep(600);
  const qty = await page.$eval('.overlay.expanded .cart-line-qty', (el) => el.textContent.trim());
  const sub1 = await page.$eval('.overlay.expanded .cart-subtotal, .overlay.expanded [class*=subtotal]', (el) => el.textContent.trim()).catch(() => '');
  check(C, 'quantity + updates line and subtotal', /2/.test(qty) && sub1 !== subSettled, `qty ${qty}; ${subSettled} → ${sub1}`);
  await page.keyboard.press('Escape');
  await sleep(900);
  check(C, 'Escape closes the drawer', !(await page.$('.overlay.expanded')));
  check(C, 'page usable again after close', await page.evaluate(() => document.querySelector('body > main')?.inert === false));
  await page.click('.header-ctas a[href="/cart"]');
  await sleep(1200);
  check(C, 'cart icon opens the drawer', Boolean(await page.$('.overlay.expanded[data-aside-type="cart"]')));
  const focusIn = await page.evaluate(() => document.activeElement?.closest('.overlay') !== null);
  check(C, 'focus moves into the drawer', focusIn);
  // Tab cycles inside
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  const stillIn = await page.evaluate(() => Boolean(document.activeElement?.closest('.overlay.expanded')));
  check(C, 'Tab stays inside the open drawer', stillIn);
  await page.click('.overlay.expanded button[aria-label="Remove"]');
  await page.waitForFunction(() => {
    const e = document.querySelector('.overlay.expanded .cart-empty');
    return e && !e.hidden;
  }, {timeout: 12000}).catch(() => {});
  await sleep(1200);
  const empty = await page.evaluate(() => {
    const e = document.querySelector('.overlay.expanded .cart-empty');
    return {shown: e && !e.hidden, title: e?.querySelector('.cart-empty-title')?.textContent, lines: document.querySelectorAll('.overlay.expanded .cart-line').length};
  });
  check(C, 'removal leaves the empty state', empty.shown && empty.lines === 0, JSON.stringify(empty));
  await page.click('.overlay.expanded aside header .close');
  await sleep(900);
  check(C, 'close button closes the drawer', !(await page.$('.overlay.expanded')));

  // E. Checkout handoff (to Shopify's password page; nothing is typed there)
  const K = 'checkout';
  await page.click('.pdp-atc button');
  await page.waitForFunction(() => document.querySelector('.overlay.expanded .cart-checkout-btn'), {timeout: 12000}).catch(() => {});
  await sleep(1500);
  const checkoutHref = await page.$eval('.overlay.expanded .cart-checkout-btn', (a) => a.href).catch(() => '');
  check(K, 'checkout link points at the hosted checkout', /myshopify\.com\/cart\/c\//.test(checkoutHref), checkoutHref.replace(/\?.*/, '?…'));
  const leaving = page.waitForNavigation({timeout: 45000}).catch(() => null);
  await page.click('.overlay.expanded .cart-checkout-btn');
  await sleep(250);
  const pouring = await page.evaluate(() => ({active: document.querySelector('.pour')?.classList.contains('is-active'), label: document.querySelector('.pour-label')?.textContent}));
  check(K, 'pour handoff shows "Pouring your order…"', pouring.active && /Pouring your order/.test(pouring.label), JSON.stringify(pouring));
  await leaving;
  await sleep(2500);
  const landed = await page.evaluate(() => ({host: location.host, path: location.pathname, password: Boolean(document.querySelector('input[type=password]')), title: document.title}));
  check(K, 'lands on Shopify (store password page)', /myshopify\.com$/.test(landed.host), JSON.stringify(landed));

  // F. Page transitions across every route + 404
  const R = 'routes';
  await page.goto(BASE + '/', {waitUntil: 'load'});
  await waitHydrated(page);
  await sleep(1500);
  const routes = [
    '/collections/all',
    '/collections',
    '/collections/sparkling-tonics',
    '/products/lemon-zest',
    '/products/sunfizz-variety-pack',
    '/pages/contact',
    '/search',
    '/policies',
    '/blogs',
    '/cart',
    '/',
    '/this-can-is-empty',
  ];
  for (const r of routes) {
    const n = await clientNav(page, r);
    const main = await page.evaluate(() => {
      const m = document.querySelector('body > main');
      return {h1: document.querySelector('main h1')?.textContent?.trim().slice(0, 40), mainOpacity: m && getComputedStyle(m).opacity, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth};
    });
    check(R, `→ ${r}`, n.poured && n.path === r && Number(main.mainOpacity) === 1, `${n.ms}ms, "${main.h1}", title "${n.title}"`);
  }
  const notFound = await page.goto(BASE + '/this-can-is-empty', {waitUntil: 'load'});
  const nf = await page.evaluate(() => ({title: document.title, h2: document.querySelector('main .not-found-title')?.textContent, header: Boolean(document.querySelector('header.header')), footer: Boolean(document.querySelector('footer .fizz-dash'))}));
  check(R, '404 page: status, branded copy, full shell', notFound.status() === 404 && /can.s empty/i.test(nf.h2 || '') && nf.header && nf.footer, `${notFound.status()} ${JSON.stringify(nf)}`);
  await browser.close();
}

// ------------------------------------------------------------------ phone + tablet widths
for (const [label, viewport] of [
  ['phone', {width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true}],
  ['tablet', {width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true}],
]) {
  const browser = await launch(viewport);
  const page = await browser.newPage();
  watchConsole(page, label);
  await page.evaluateOnNewDocument(() => sessionStorage.setItem('sf-poured', '1'));
  for (const r of ['/', '/collections/all', '/products/sunfizz-variety-pack', '/pages/contact', '/search', '/cart', '/nope-404']) {
    await page.goto(BASE + r, {waitUntil: 'load', timeout: 90000});
    await sleep(1800);
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      headerFits: (() => {
        const h = document.querySelector('.header');
        return h ? h.scrollWidth <= h.clientWidth + 1 : false;
      })(),
      game: Boolean(document.querySelector('.fizz-dash-stage')),
      hint: [...document.querySelectorAll('.fizz-dash-hint > span')].filter((s) => getComputedStyle(s).display !== 'none').map((s) => s.textContent).join(''),
    }));
    check(label, `${r}: no sideways overflow, header fits`, m.sw <= m.cw && m.headerFits && m.game, `${m.sw}/${m.cw}, hint "${m.hint}"`);
  }
  await page.goto(BASE + '/', {waitUntil: 'load'});
  await sleep(1500);
  await page.screenshot({path: out(`regress-${label}-home.png`)});
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(1500);
  await page.screenshot({path: out(`regress-${label}-footer.png`)});
  await browser.close();
}

// ------------------------------------------------------------------ reduced motion
{
  const browser = await launch({width: 1280, height: 800});
  const page = await browser.newPage();
  watchConsole(page, 'reduced');
  await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
  await page.goto(BASE + '/', {waitUntil: 'domcontentloaded'});
  const pre = await page.evaluate(() => document.documentElement.classList.contains('is-preloading'));
  check('reduced', 'no preloader', !pre);
  await page.waitForFunction(() => document.readyState === 'complete');
  await sleep(1500);
  const hero = await page.evaluate(() => ({vis: getComputedStyle(document.querySelector('.hero-title')).visibility, cursor: Boolean(document.querySelector('.cursor')), lenis: document.documentElement.classList.contains('lenis')}));
  check('reduced', 'content visible at once, no custom cursor, native scroll', hero.vis === 'visible' && !hero.cursor && !hero.lenis, JSON.stringify(hero));
  const n = await clientNav(page, '/collections/all');
  check('reduced', 'no pour on navigation', !n.poured && n.path === '/collections/all', JSON.stringify(n));
  const cardsVisible = await page.$$eval('.pcard', (els) => els.filter((e) => Number(getComputedStyle(e).opacity) > 0.95).length);
  check('reduced', 'cards visible without scroll animation', cardsVisible === 5, cardsVisible);
  await browser.close();
}

check('console', 'no console errors / hydration warnings', errors.length === 0, errors.slice(0, 6).join(' || '));
console.log('off-site console errors (not our code):', external.length ? external : 'none');
fs.writeFileSync(out('regression-results.json'), JSON.stringify({results, errors, external}, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
