// Fizz Dash behaviour test in real (headless) Chrome.
// Usage: node game-test.mjs [baseUrl] [mode]   mode: desktop | mobile | reduced
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
const MODE = process.argv[3] || 'desktop';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({name, ok, detail});
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'],
  defaultViewport:
    MODE === 'mobile'
      ? {width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true}
      : {width: 1440, height: 900, deviceScaleFactor: 1},
});
const page = await browser.newPage();
if (MODE === 'reduced') await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: 'reduce'}]);
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

// Skip the first-load preloader; count and time the game's rAF callbacks (the engine's loop is `frame`).
await page.evaluateOnNewDocument(() => {
  try {
    sessionStorage.setItem('sf-poured', '1');
  } catch {}
  window.__game = {frames: 0, cost: []};
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      if (cb.name === 'frame') {
        const t0 = performance.now();
        cb(t);
        window.__game.frames++;
        window.__game.cost.push(performance.now() - t0);
      } else cb(t);
    });
});

const gameChunkLoaded = () =>
  page.evaluate(() => performance.getEntriesByType('resource').some((e) => /fizzDash/.test(e.name)));
const stageState = () => page.$eval('.fizz-dash-stage', (el) => el.dataset.state);
// How often the game canvas actually changed during `ms` (works on dev and minified production builds).
const framesIn = (ms) =>
  page.evaluate(async (dur) => {
    const c = document.querySelector('.fizz-dash-canvas');
    const ctx = c.getContext('2d');
    const hash = () => {
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0;
      return h;
    };
    let last = hash();
    let changes = 0;
    const end = performance.now() + dur;
    await new Promise((resolve) => {
      const tick = () => {
        const h = hash();
        if (h !== last) { changes++; last = h; }
        if (performance.now() < end) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return changes;
  }, ms);
const visibleAction = () =>
  page.$$eval('.fizz-dash-action > span', (spans) =>
    spans.filter((s) => getComputedStyle(s).display !== 'none').map((s) => s.textContent).join(' | '),
  );
const shot = (name) => page.screenshot({path: `${OUT_DIR}/game-${MODE}-${name}.png`});
const stageShot = async (name) => {
  const el = await page.$('.fizz-dash');
  await el.screenshot({path: `${OUT_DIR}/game-${MODE}-${name}.png`});
};

await page.goto(BASE + '/', {waitUntil: 'load', timeout: 90000});
await page.waitForFunction(() => document.documentElement.classList.contains('lenis') || matchMedia('(prefers-reduced-motion: reduce)').matches, {timeout: 30000});
await sleep(1500);

check('game code not loaded at page load', !(await gameChunkLoaded()));
check('stage server-rendered in the footer', Boolean(await page.$('footer .fizz-dash-stage')));

// Scroll down to the footer: the chunk should load (IntersectionObserver + idle).
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => /fizzDash/.test(e.name)), {timeout: 15000}).catch(() => {});
await sleep(1500);
check('game code loads when the footer is near', await gameChunkLoaded());
const painted = await page.$eval('.fizz-dash-canvas', (c) => {
  const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < x.length; i += 4) if (x[i] > 0) n++;
  return {n, w: c.width, h: c.height};
});
check('poster frame drawn on the canvas', painted.n > 500, `${painted.n} px, canvas ${painted.w}x${painted.h}`);
check('idle: no game loop running', (await framesIn(1000)) === 0);
const idleCopy = await visibleAction();
check('idle instruction fits the input', MODE === 'mobile' ? idleCopy === 'Tap to play' : idleCopy === 'Click to play', idleCopy);
await stageShot('1-idle');

// Space with focus elsewhere must not be captured by the game.
const spaceOutside = await page.evaluate(() => {
  document.activeElement?.blur();
  let prevented = null;
  const probe = (e) => {
    if (e.key === ' ') setTimeout(() => (prevented = e.defaultPrevented), 0);
  };
  window.addEventListener('keydown', probe);
  window.__probe = () => prevented;
  return true;
});
await page.keyboard.press('Space');
await sleep(100);
check('Space outside the game is not captured', (await page.evaluate(() => window.__probe())) === false);
check('Space outside the game does not start it', (await stageState()) === 'idle');

// Click (or tap) the stage: the game starts.
const box = await (await page.$('.fizz-dash-stage')).boundingBox();
if (MODE === 'mobile') await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await sleep(300);
check('click/tap starts the game', (await stageState()) === 'running');
const focused = await page.evaluate(() => document.activeElement?.classList.contains('fizz-dash-stage'));
if (MODE !== 'mobile') check('the stage has focus after the click', focused);
const f = await framesIn(1000);
// Reduced motion: the scene only moves once obstacles arrive (~2s); until then only the score changes.
check('running: canvas redraws', f > (MODE === 'reduced' ? 2 : 30), `${f} changed frames/s`);

// Jump while running: Space is captured (no scroll) and keeps the can alive for a bit.
await page.evaluate(() => {
  window.__jumpPrevented = null;
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === ' ') setTimeout(() => (window.__jumpPrevented = e.defaultPrevented), 0);
    },
    {once: true},
  );
});
if (MODE === 'mobile') await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
else await page.keyboard.press('Space');
await sleep(50);
if (MODE !== 'mobile') check('Space while playing is captured (no page scroll)', (await page.evaluate(() => window.__jumpPrevented)) === true);
await sleep(250);
await stageShot('2-running');

// Don't jump any more: the can must crash into something.
await page.waitForFunction(() => document.querySelector('.fizz-dash-stage').dataset.state === 'over', {timeout: 20000}).catch(() => {});
check('collision ends the game', (await stageState()) === 'over');
const overlay = await page.$eval('.fizz-dash-overlay', (el) => el.textContent);
check('game-over overlay', /Fizzled out!/.test(overlay), overlay);
const live = await page.$eval('.fizz-dash [role=status]', (el) => el.textContent);
check('game over announced', /Fizzled out/.test(live), live);
check('over: loop stopped', (await framesIn(800)) === 0);
await stageShot('3-over');
const best = await page.evaluate(() => localStorage.getItem('sf-fizz-dash-best'));
check('best score saved', Number(best) > 0, `best ${best}`);

// Restart with Space (desktop) or a tap (mobile).
await sleep(500);
if (MODE === 'mobile') await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
else await page.keyboard.press('Space');
await sleep(300);
check('restart', (await stageState()) === 'running');

// Scroll away: pauses; loop stops.
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(800);
check('scrolled out of view: paused', (await stageState()) === 'paused');
check('paused: loop stopped', (await framesIn(800)) === 0);

// Back, resume, then blur (Tab away): pauses.
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await sleep(800);
if (MODE === 'mobile') {
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
} else {
  await page.focus('.fizz-dash-stage');
  await page.keyboard.press('Space');
}
await sleep(300);
check('resume', (await stageState()) === 'running');
if (MODE !== 'mobile') {
  await page.keyboard.press('Tab');
  await sleep(200);
  check('Tab moves focus on (no trap)', !(await page.evaluate(() => document.activeElement?.classList.contains('fizz-dash-stage'))));
  check('focus leaving pauses', (await stageState()) === 'paused');
  check('unfocused pause says Click', (await visibleAction()) === 'Click to keep fizzing', await visibleAction());
  // Escape pauses too.
  await page.focus('.fizz-dash-stage');
  await page.keyboard.press('Space');
  await sleep(200);
  await page.keyboard.press('Escape');
  await sleep(100);
  check('Escape pauses', (await stageState()) === 'paused');
  check('focused pause says Space', (await visibleAction()) === 'Press Space to keep fizzing', await visibleAction());
}

// Tab hidden: pauses.
await page.focus('.fizz-dash-stage').catch(() => {});
await page.keyboard.press('Space');
await sleep(200);
const hidden = await browser.newPage();
await hidden.goto('about:blank');
await hidden.bringToFront();
await sleep(600);
await page.bringToFront();
check('tab hidden: paused', (await stageState()) === 'paused');
await hidden.close();

// Navigate to another page (client-side): resets to idle.
await page.focus('.fizz-dash-stage').catch(() => {});
await page.keyboard.press('Space');
await sleep(200);
await page.evaluate(() => document.querySelector('header a[href="/collections/all"]')?.click());
await sleep(2500);
check('navigation resets to idle', (await stageState()) === 'idle', await page.evaluate(() => location.pathname));
check('after navigation: no loop', (await framesIn(800)) === 0);

const cost = await page.evaluate(() => {
  const c = window.__game.cost.slice().sort((a, b) => a - b);
  return {n: c.length, avg: c.reduce((a, b) => a + b, 0) / c.length, p95: c[Math.floor(c.length * 0.95)], max: c[c.length - 1]};
});
console.log('game loop cost per frame (ms):', cost.n ? JSON.stringify(cost) : 'n/a here (production builds minify the loop function name; measure on the dev server)');
console.log('console errors/warnings:', consoleErrors.length ? consoleErrors : 'none');
fs.writeFileSync(`${OUT_DIR}/game-${MODE}-results.json`, JSON.stringify({results, cost, consoleErrors}, null, 1));
await browser.close();
