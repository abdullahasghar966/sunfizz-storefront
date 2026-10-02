// Frame pacing + main-thread cost with the footer game idle vs running (production build, real GPU).
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
const BASE = process.argv[2] || 'http://localhost:3002';
const CPU = Number(process.argv[3] || 1); // 1 = this PC, 4 = phone-class CPU
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: {width: 1440, height: 900},
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => sessionStorage.setItem('sf-poured', '1'));
const cdp = await page.createCDPSession();
await cdp.send('Performance.enable');
if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', {rate: CPU});

async function metrics() {
  const {metrics: m} = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(m.map((x) => [x.name, x.value]));
}

async function sample(label, ms, during) {
  await page.evaluate(() => {
    window.__f = [];
    window.__lt = [];
    let last = performance.now();
    window.__on = true;
    const tick = (t) => {
      window.__f.push(t - last);
      last = t;
      if (window.__on) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__po?.disconnect();
    window.__po = new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration))));
    window.__po.observe({type: 'longtask'});
  });
  const m0 = await metrics();
  const t0 = Date.now();
  if (during) await during(ms);
  else await sleep(ms);
  const wall = (Date.now() - t0) / 1000;
  const m1 = await metrics();
  const r = await page.evaluate(() => {
    window.__on = false;
    const f = window.__f.slice(2).sort((a, b) => a - b);
    const med = f[f.length >> 1];
    return {
      fps: +(f.length / (f.reduce((a, b) => a + b, 0) / 1000)).toFixed(0),
      p95: +f[Math.floor(f.length * 0.95)].toFixed(1),
      dropped: +((f.filter((x) => x > med * 1.5).length / f.length) * 100).toFixed(1),
      longTasks: window.__lt.length,
      state: document.querySelector('.fizz-dash-stage')?.dataset.state,
    };
  });
  const busy = ((m1.TaskDuration - m0.TaskDuration) / wall) * 100;
  const script = ((m1.ScriptDuration - m0.ScriptDuration) / wall) * 100;
  console.log(
    `${label.padEnd(40)} fps ${String(r.fps).padStart(3)} | p95 ${String(r.p95).padStart(5)} ms | dropped ${String(r.dropped).padStart(4)}% | main thread busy ${busy.toFixed(1).padStart(5)}% (script ${script.toFixed(1)}%) | long tasks ${r.longTasks} | game ${r.state}`,
  );
  return {label, ...r, busy, script};
}

async function playFor(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const state = await page.$eval('.fizz-dash-stage', (el) => el.dataset.state);
    if (state === 'over') await sleep(450);
    await page.keyboard.press('Space'); // jump, or restart after a crash
    await sleep(380 + Math.random() * 300);
  }
}

const rows = [];
for (const [name, path] of [
  ['home', '/'],
  ['product', '/products/citrus-sunrise'],
]) {
  await page.goto(BASE + path, {waitUntil: 'load', timeout: 90000});
  await page.waitForFunction(() => document.documentElement.classList.contains('lenis'), {timeout: 30000});
  await page.mouse.move(700, 400); // intent: lets the PDP load its 3D viewer
  await sleep(3500);
  rows.push(await sample(`${name}: top of page (baseline)`, 4000));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(2500);
  const vis = await page.evaluate(() => {
    const r = document.querySelector('.pdp-stage canvas')?.getBoundingClientRect();
    return r ? r.bottom > 0 && r.top < innerHeight : false;
  });
  rows.push(await sample(`${name}: footer, game idle`, 4000));
  const box = await (await page.$('.fizz-dash-stage')).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(200);
  rows.push(await sample(`${name}: footer, game running${vis ? ' + 3D on screen' : ''}`, 8000, playFor));
  // Smooth scroll up with the game running: it should pause itself as it leaves.
  rows.push(
    await sample(`${name}: Lenis scroll up while playing`, 2500, async () => {
      for (let i = 0; i < 20; i++) {
        await page.mouse.wheel({deltaY: -120});
        await sleep(90);
      }
      await sleep(600);
    }),
  );
}
fs.writeFileSync(out(`perf-game-cpu${CPU}.json`), JSON.stringify(rows, null, 1));
await browser.close();
