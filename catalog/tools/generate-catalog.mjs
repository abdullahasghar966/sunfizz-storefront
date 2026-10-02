// Generates the Sunfizz placeholder catalog: flavour packshots (PNG) + a Shopify product CSV.
// Usage, from the project root:
//   npm i --no-save @resvg/resvg-js
//   node catalog/tools/generate-catalog.mjs
// Fonts: static Fredoka 500/600/700 TTFs from Google Fonts (SIL Open Font License) in ./fonts.
import {Resvg} from '@resvg/resvg-js';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..'); // catalog/
const IMG_DIR = join(OUT, 'images');
const CDN = 'https://cdn.shopify.com/s/files/1/0984/3087/7969/files/';
const FONTS = ['500', '600', '700'].map((w) => join(HERE, 'fonts', `Fredoka-${w}.ttf`));
const INK = '#2a1409';

const FLAVOURS = [
  {
    handle: 'citrus-sunrise',
    title: 'Citrus Sunrise',
    label: 'CITRUS SUNRISE',
    notes: 'Orange, tangerine & ginger',
    blurb: 'Sunny orange and tangerine with a warm kick of ginger. Our brightest sip.',
    tag: 'orange',
    body: ['#d4460a', '#ff7a1a', '#ff9d48', '#c43f09'],
    accent: '#e0560e',
    peel: '#ff9f2e',
    flesh: '#ffc56b',
    bodyText: '#fff',
    bg: '#ffd9bd',
    bgLight: '#fff1e4',
  },
  {
    handle: 'pink-grapefruit-glow',
    title: 'Pink Grapefruit Glow',
    label: 'PINK GRAPEFRUIT',
    notes: 'Pink grapefruit & hibiscus',
    blurb: 'Tangy pink grapefruit softened with floral hibiscus. Tart, pink and lively.',
    tag: 'grapefruit',
    body: ['#c42f40', '#ff5a5f', '#ff8a8c', '#b02736'],
    accent: '#d93a4a',
    peel: '#ff6f73',
    flesh: '#ffb3b5',
    bodyText: '#fff',
    bg: '#ffd3d5',
    bgLight: '#fff0f0',
  },
  {
    handle: 'lemon-zest',
    title: 'Lemon Zest',
    label: 'LEMON ZEST',
    notes: 'Sicilian lemon & garden mint',
    blurb: 'Zingy Sicilian lemon with a cool breath of garden mint. Pure refreshment.',
    tag: 'lemon',
    body: ['#d9a300', '#ffd23f', '#ffe588', '#c99500'],
    accent: '#9a7200',
    peel: '#ffd23f',
    flesh: '#fff0a3',
    bodyText: INK,
    bg: '#ffeaa1',
    bgLight: '#fff9e0',
  },
  {
    handle: 'lime-crush',
    title: 'Lime Crush',
    label: 'LIME CRUSH',
    notes: 'Key lime & cucumber',
    blurb: 'Sharp key lime and crisp cucumber. Like a garden party in a can.',
    tag: 'lime',
    body: ['#4b9420', '#7cc242', '#a8e04c', '#3f841a'],
    accent: '#3f7f14',
    peel: '#8fd14f',
    flesh: '#d4f39a',
    bodyText: INK,
    bg: '#dcf2c2',
    bgLight: '#f4fbe9',
  },
];

// ---------- SVG building blocks (the can matches app/components/home/HeroCan.tsx) ----------

const slice = (r, peel, flesh) => `
  <circle r="${r}" fill="${peel}" stroke="#fff" stroke-width="${r * 0.16}"/>
  <circle r="${r * 0.72}" fill="${flesh}"/>
  ${[0, 60, 120, 180, 240, 300]
    .map((a) => `<line y2="${-r * 0.72}" stroke="#fff" stroke-width="${r * 0.1}" stroke-linecap="round" transform="rotate(${a})"/>`)
    .join('')}`;

function can(f, id) {
  return `
  <defs>
    <linearGradient id="body-${id}" x1="0" x2="1">
      <stop offset="0" stop-color="${f.body[0]}"/><stop offset="0.22" stop-color="${f.body[1]}"/>
      <stop offset="0.5" stop-color="${f.body[2]}"/><stop offset="0.8" stop-color="${f.body[1]}"/>
      <stop offset="1" stop-color="${f.body[3]}"/>
    </linearGradient>
    <linearGradient id="rim-${id}" x1="0" x2="1">
      <stop offset="0" stop-color="#b9ae9f"/><stop offset="0.45" stop-color="#f7f2eb"/><stop offset="1" stop-color="#ada190"/>
    </linearGradient>
    <linearGradient id="label-${id}" x1="0" x2="1">
      <stop offset="0" stop-color="#f1e2c8"/><stop offset="0.5" stop-color="#fffaf1"/><stop offset="1" stop-color="#ecdbbf"/>
    </linearGradient>
  </defs>
  <rect x="52" y="16" width="156" height="30" rx="13" fill="url(#rim-${id})"/>
  <rect x="40" y="32" width="180" height="400" rx="40" fill="url(#body-${id})"/>
  <rect x="54" y="418" width="152" height="28" rx="13" fill="url(#rim-${id})"/>
  <path d="M40 160 C70 144 100 176 130 160 S190 176 220 160 L220 326 C190 342 160 310 130 326 S70 310 40 326 Z" fill="url(#label-${id})"/>
  <g transform="translate(130 196)">${slice(24, f.peel, f.flesh)}</g>
  <text x="130" y="264" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="46" letter-spacing="1" fill="${INK}">SUN</text>
  <text x="130" y="308" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="46" letter-spacing="1" fill="${f.accent}">FIZZ</text>
  <rect x="50" y="350" width="160" height="26" rx="13" fill="#fff7e8"/>
  <text x="130" y="367.5" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="11.5" letter-spacing="1.3" fill="${INK}">${f.label}</text>
  <text x="130" y="401" text-anchor="middle" font-family="Fredoka" font-weight="500" font-size="10.5" letter-spacing="2.4" fill="${f.bodyText}" opacity="0.8">330 ML · 5G SUGAR</text>
  <rect x="60" y="54" width="14" height="358" rx="7" fill="#fff" opacity="0.28"/>
  <rect x="82" y="54" width="5" height="358" rx="2.5" fill="#fff" opacity="0.18"/>
  <circle cx="186" cy="92" r="8" fill="#fff" opacity="0.3"/>
  <circle cx="170" cy="120" r="4.5" fill="#fff" opacity="0.3"/>`;
}

const SPARKLE = 'M50 0 C54 36 64 46 100 50 C64 54 54 64 50 100 C46 64 36 54 0 50 C36 46 46 36 50 0 Z';
const bubble = (x, y, r, color) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity="0.45" stroke="${color}" stroke-width="${Math.max(4, r * 0.1)}" stroke-opacity="0.8"/>
   <path d="M${x - r * 0.45} ${y - r * 0.3} A${r * 0.55} ${r * 0.55} 0 0 1 ${x - r * 0.05} ${y - r * 0.62}" fill="none" stroke="#fff" stroke-width="${Math.max(5, r * 0.14)}" stroke-linecap="round"/>`;
const sparkle = (x, y, size, color) =>
  `<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})"><path d="${SPARKLE}" fill="${color}"/></g>`;

function scene({bg, bgLight, content, decor}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000" viewBox="0 0 2000 2000">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${bgLight}"/><stop offset="1" stop-color="${bg}"/></radialGradient>
    <radialGradient id="shadow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#5a3a28" stop-opacity="0.32"/><stop offset="1" stop-color="#5a3a28" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="2000" height="2000" fill="url(#bg)"/>
  <circle cx="1000" cy="930" r="660" fill="#fff" opacity="0.32"/>
  ${decor}
  <ellipse cx="1000" cy="1800" rx="560" ry="80" fill="url(#shadow)"/>
  ${content}
</svg>`;
}

// A single can standing on the shadow: local can is 260×470, bottom rim at y≈446.
function placedCan(f, id, {cx = 1000, bottom = 1790, scale = 3.25, tilt = -6} = {}) {
  return `<g transform="translate(${cx - 130 * scale} ${bottom - 446 * scale}) scale(${scale}) rotate(${tilt} 130 235)">${can(f, id)}</g>`;
}

function flavourImage(f) {
  const decor = [
    `<g transform="translate(330 360) rotate(-20)" opacity="0.9">${slice(150, f.peel, f.flesh)}</g>`,
    `<g transform="translate(1690 1420) rotate(25)" opacity="0.9">${slice(120, f.peel, f.flesh)}</g>`,
    bubble(1620, 420, 70, f.accent),
    bubble(1760, 700, 36, f.accent),
    bubble(300, 1280, 54, f.accent),
    bubble(460, 1560, 28, f.accent),
    sparkle(1480, 250, 90, f.accent),
    sparkle(560, 820, 60, '#ffd23f'),
  ].join('');
  return scene({bg: f.bg, bgLight: f.bgLight, decor, content: placedCan(f, f.handle)});
}

function varietyImage() {
  // Fan of four cans: outer pair first, inner pair on top.
  const spots = [
    {i: 0, cx: 560, tilt: -13, bottom: 1760},
    {i: 3, cx: 1440, tilt: 13, bottom: 1760},
    {i: 1, cx: 845, tilt: -4, bottom: 1800},
    {i: 2, cx: 1155, tilt: 4, bottom: 1800},
  ];
  const content = spots
    .map((s) => placedCan(FLAVOURS[s.i], `v${s.i}`, {cx: s.cx, bottom: s.bottom, scale: 2.6, tilt: s.tilt}))
    .join('');
  const decor = [
    `<g transform="translate(260 300) rotate(-20)" opacity="0.9">${slice(120, FLAVOURS[0].peel, FLAVOURS[0].flesh)}</g>`,
    `<g transform="translate(1740 330) rotate(15)" opacity="0.9">${slice(110, FLAVOURS[3].peel, FLAVOURS[3].flesh)}</g>`,
    bubble(1000, 250, 60, '#e0560e'),
    bubble(1780, 1250, 40, '#d93a4a'),
    bubble(220, 1250, 48, '#3f7f14'),
    sparkle(1320, 420, 80, '#e0560e'),
    sparkle(640, 500, 60, '#ffd23f'),
  ].join('');
  return scene({bg: '#ffe7b8', bgLight: '#fff8ea', decor, content});
}

// ---------- "poured glass" lifestyle shots (the hover image on product cards) ----------

// Seeded PRNG so bubbles and condensation land in the same place on every run.
function rng(seedText) {
  let a = [...seedText].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 7) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MINT = '#3f9d45';
const MINT_DARK = '#2c7a33';

const leaf = (l, fill = MINT) => `
  <path d="M0 0 C${l * 0.25} ${-l * 0.34} ${l * 0.75} ${-l * 0.34} ${l} 0 C${l * 0.75} ${l * 0.34} ${l * 0.25} ${l * 0.34} 0 0 Z" fill="${fill}"/>
  <path d="M${l * 0.06} 0 L${l * 0.9} 0" stroke="#bfe8a8" stroke-width="${l * 0.035}" stroke-linecap="round" opacity="0.8"/>
  ${[0.3, 0.5, 0.7]
    .map((t) => `<path d="M${l * t} 0 l${l * 0.1} ${-l * 0.12} M${l * t} 0 l${l * 0.1} ${l * 0.12}" stroke="#bfe8a8" stroke-width="${l * 0.02}" stroke-linecap="round" opacity="0.6"/>`)
    .join('')}`;

// A mint sprig: stem from (0,0) upwards with paired leaves.
const mintSprig = (len) => {
  const pairs = [0.35, 0.6, 0.82];
  return `<path d="M0 0 Q${len * 0.06} ${-len * 0.5} ${-len * 0.02} ${-len}" stroke="${MINT_DARK}" stroke-width="${len * 0.03}" fill="none" stroke-linecap="round"/>
    ${pairs
      .map((t, i) => {
        const y = -len * t;
        const l = len * (0.2 - i * 0.035);
        return `<g transform="translate(0 ${y}) rotate(-35)">${leaf(l)}</g><g transform="translate(0 ${y}) scale(-1 1) rotate(-35)">${leaf(l, MINT_DARK)}</g>`;
      })
      .join('')}
    <g transform="translate(${-len * 0.02} ${-len}) rotate(-90)">${leaf(len * 0.1)}</g>`;
};

const hibiscus = (p, id) => `
  <defs><radialGradient id="hib-${id}" cx="0" cy="0" r="${p}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#7d0a33"/><stop offset="0.28" stop-color="#b8134f"/><stop offset="1" stop-color="#f0417a"/>
  </radialGradient></defs>
  ${[0, 72, 144, 216, 288]
    .map((a) => `<path transform="rotate(${a})" d="M0 0 C${-p * 0.62} ${-p * 0.3} ${-p * 0.62} ${-p * 1.05} 0 ${-p} C${p * 0.62} ${-p * 1.05} ${p * 0.62} ${-p * 0.3} 0 0 Z" fill="url(#hib-${id})" stroke="#ffd0de" stroke-width="${p * 0.02}" stroke-opacity="0.6"/>`)
    .join('')}
  <path d="M0 0 L${p * 0.12} ${-p * 0.78}" stroke="#ffd0de" stroke-width="${p * 0.05}" stroke-linecap="round"/>
  ${[[0.1, -0.8], [0.2, -0.74], [0.02, -0.72], [0.16, -0.86]]
    .map(([x, y]) => `<circle cx="${p * x}" cy="${p * y}" r="${p * 0.045}" fill="#ffd23f"/>`)
    .join('')}`;

const gingerSlice = (r) => `
  <ellipse rx="${r}" ry="${r * 0.82}" fill="#f4dc9c" stroke="#c49549" stroke-width="${r * 0.1}"/>
  <ellipse rx="${r * 0.66}" ry="${r * 0.52}" fill="none" stroke="#e2bb68" stroke-width="${r * 0.05}" opacity="0.8"/>
  ${[[-0.3, -0.1], [0.2, 0.15], [0.05, -0.25], [-0.1, 0.25], [0.35, -0.05]]
    .map(([x, y]) => `<circle cx="${r * x}" cy="${r * y}" r="${r * 0.045}" fill="#d3a860"/>`)
    .join('')}`;

const cucumberSlice = (r) => `
  <circle r="${r}" fill="#2f7d2a"/>
  <circle r="${r * 0.88}" fill="#c9eb97"/>
  <circle r="${r * 0.56}" fill="#e4f6c2"/>
  ${[0, 45, 90, 135, 180, 225, 270, 315]
    .map((a) => `<ellipse transform="rotate(${a}) translate(0 ${-r * 0.33})" rx="${r * 0.06}" ry="${r * 0.11}" fill="#f8fdeb" stroke="#b1d785" stroke-width="${r * 0.02}"/>`)
    .join('')}`;

// Whole fruit: kind 'round' (orange, lime) or 'lemon'. Optional leaf on top.
const wholeFruit = (r, color, kind = 'round', withLeaf = false) => `
  ${kind === 'lemon'
    ? `<ellipse rx="${r * 1.28}" ry="${r}" fill="${color}"/><circle cx="${r * 1.28}" r="${r * 0.14}" fill="${color}"/><circle cx="${-r * 1.28}" r="${r * 0.12}" fill="${color}"/>`
    : `<circle r="${r}" fill="${color}"/>`}
  <ellipse cx="${-r * 0.35}" cy="${-r * 0.38}" rx="${r * 0.32}" ry="${r * 0.2}" transform="rotate(-30 ${-r * 0.35} ${-r * 0.38})" fill="#fff" opacity="0.35"/>
  ${[[0.3, 0.2], [0.1, 0.45], [0.5, -0.1], [-0.2, 0.3], [0.35, 0.55]]
    .map(([x, y]) => `<circle cx="${r * x}" cy="${r * y}" r="${r * 0.03}" fill="#000" opacity="0.12"/>`)
    .join('')}
  ${withLeaf ? `<path d="M0 ${-r * 0.96} q${r * 0.02} ${-r * 0.18} ${-r * 0.06} ${-r * 0.28}" stroke="#6b4a2a" stroke-width="${r * 0.06}" stroke-linecap="round" fill="none"/><g transform="translate(0 ${-r * 1.02}) rotate(-25)">${leaf(r * 0.7, '#4a9a3c')}</g>` : ''}`;

// A tall glass of the tonic with ice, bubbles, condensation and an optional straw.
// `inside` is drawn in the liquid (behind the glass wall); `onTop` over everything (e.g. a rim garnish).
function pouredGlass(f, id, {cx, bottom, w, h, straw = null, inside = '', behindLiquid = '', onTop = ''}) {
  const top = bottom - h;
  const wb = w * 0.86;
  const base = h * 0.075;
  const wall = w * 0.04;
  const liquidTop = top + h * 0.17;
  const innerBottom = bottom - base;
  const halfAt = (y) => w / 2 + ((wb - w) / 2) * ((y - top) / h);
  const rr = w * 0.06;
  const rand = rng(id);

  const outline = `M${cx - w / 2} ${top} L${cx + w / 2} ${top} L${cx + wb / 2} ${bottom - rr} Q${cx + wb / 2} ${bottom} ${cx + wb / 2 - rr} ${bottom} L${cx - wb / 2 + rr} ${bottom} Q${cx - wb / 2} ${bottom} ${cx - wb / 2} ${bottom - rr} Z`;
  const liqL = (y) => cx - halfAt(y) + wall;
  const liqR = (y) => cx + halfAt(y) - wall;
  const lr = w * 0.04;
  const liquid = `M${liqL(liquidTop)} ${liquidTop} L${liqR(liquidTop)} ${liquidTop} L${liqR(innerBottom)} ${innerBottom - lr} Q${liqR(innerBottom)} ${innerBottom} ${liqR(innerBottom) - lr} ${innerBottom} L${liqL(innerBottom) + lr} ${innerBottom} Q${liqL(innerBottom)} ${innerBottom} ${liqL(innerBottom)} ${innerBottom - lr} Z`;

  const cubes = [
    [-0.17, 0.05, 0.3, -12],
    [0.15, 0.02, 0.27, 17],
    [-0.02, 0.19, 0.26, 6],
  ]
    .map(([dx, dy, s, rot]) => {
      const size = w * s;
      const x = cx + w * dx;
      const y = liquidTop + h * dy;
      return `<g transform="translate(${x} ${y}) rotate(${rot})">
        <rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="${size * 0.16}" fill="#fff" fill-opacity="0.4" stroke="#fff" stroke-opacity="0.9" stroke-width="${w * 0.011}"/>
        <path d="M${-size * 0.3} ${size * 0.05} L${-size * 0.3} ${-size * 0.3} L${size * 0.1} ${-size * 0.3}" stroke="#fff" stroke-width="${w * 0.014}" stroke-linecap="round" fill="none" opacity="0.9"/>
      </g>`;
    })
    .join('');

  let bubbles = '';
  for (let i = 0; i < 46; i++) {
    const y = liquidTop + 40 + rand() * (innerBottom - liquidTop - 70);
    const half = halfAt(y) - wall - 18;
    const x = cx + (rand() * 2 - 1) * half;
    const r = 3 + rand() * rand() * w * 0.022;
    bubbles += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff" fill-opacity="0.3" stroke="#fff" stroke-opacity="0.85" stroke-width="${Math.max(2, r * 0.25).toFixed(1)}"/>`;
  }

  let drops = '';
  for (let i = 0; i < 34; i++) {
    const y = liquidTop + 30 + rand() * (innerBottom - liquidTop - 40);
    const half = halfAt(y) - wall * 0.5;
    const x = cx + (rand() * 2 - 1) * half * 0.92;
    const rx = 3 + rand() * w * 0.013;
    drops += `<ellipse cx="${(x + 1.5).toFixed(1)}" cy="${(y + 2).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * 1.3).toFixed(1)}" fill="#000" opacity="0.08"/>
      <ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${(rx * 1.3).toFixed(1)}" fill="#fff" opacity="0.6"/>
      <circle cx="${(x - rx * 0.35).toFixed(1)}" cy="${(y - rx * 0.5).toFixed(1)}" r="${(rx * 0.28).toFixed(1)}" fill="#fff"/>`;
  }
  const trails = [-0.28, 0.2, 0.33]
    .map((t, i) => {
      const x = cx + w * t;
      const y0 = liquidTop + h * (0.25 + i * 0.12);
      return `<path d="M${x} ${y0} q${w * 0.01} ${h * 0.08} 0 ${h * 0.16}" stroke="#fff" stroke-width="${w * 0.012}" stroke-linecap="round" fill="none" opacity="0.45"/>`;
    })
    .join('');

  let strawSvg = '';
  if (straw) {
    const {x0, y0, x1, y1, color} = straw;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    const sw = w * 0.075;
    strawSvg = `<defs><pattern id="straw-${id}" patternUnits="userSpaceOnUse" width="${sw * 1.4}" height="${sw * 1.4}" patternTransform="rotate(40)">
        <rect width="${sw * 1.4}" height="${sw * 1.4}" fill="#fffaf1"/><rect width="${sw * 0.7}" height="${sw * 1.4}" fill="${color}"/>
      </pattern></defs>
      <g transform="translate(${x0} ${y0}) rotate(${ang})">
        <rect x="0" y="${-sw / 2}" width="${len}" height="${sw}" rx="${sw * 0.2}" fill="url(#straw-${id})"/>
        <rect x="0" y="${-sw / 2}" width="${len}" height="${sw * 0.28}" fill="#fff" opacity="0.35"/>
      </g>`;
  }

  return `
  <defs>
    <linearGradient id="liq-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${f.flesh}"/><stop offset="1" stop-color="${f.body[1]}"/>
    </linearGradient>
    <linearGradient id="shade-${id}" x1="0" x2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.35" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.14"/>
    </linearGradient>
  </defs>
  ${behindLiquid}
  ${strawSvg}
  <path d="${liquid}" fill="url(#liq-${id})" opacity="0.84"/>
  <path d="${liquid}" fill="url(#shade-${id})"/>
  ${bubbles}
  ${cubes}
  <ellipse cx="${cx}" cy="${liquidTop}" rx="${liqR(liquidTop) - cx}" ry="${w * 0.045}" fill="${f.flesh}" stroke="#fff" stroke-opacity="0.7" stroke-width="${w * 0.008}"/>
  ${inside}
  <path d="${outline}" fill="#fff" fill-opacity="0.14" stroke="#fff" stroke-opacity="0.95" stroke-width="${w * 0.016}" stroke-linejoin="round"/>
  <path d="M${cx - wb / 2 + wall * 0.5} ${innerBottom} L${cx + wb / 2 - wall * 0.5} ${innerBottom} L${cx + wb / 2} ${bottom - rr} Q${cx + wb / 2} ${bottom} ${cx + wb / 2 - rr} ${bottom} L${cx - wb / 2 + rr} ${bottom} Q${cx - wb / 2} ${bottom} ${cx - wb / 2} ${bottom - rr} Z" fill="#fff" fill-opacity="0.4"/>
  <path d="M${cx - halfAt(top) + wall * 1.6} ${top + h * 0.07} L${cx - halfAt(bottom) + wall * 1.6} ${bottom - base * 1.4}" stroke="#fff" stroke-opacity="0.6" stroke-width="${w * 0.035}" stroke-linecap="round"/>
  <path d="M${cx - halfAt(top) + wall * 3.2} ${top + h * 0.1} L${cx - halfAt(top) + wall * 3.1} ${top + h * 0.45}" stroke="#fff" stroke-opacity="0.45" stroke-width="${w * 0.012}" stroke-linecap="round"/>
  <path d="M${cx + halfAt(top) - wall * 1.2} ${top + h * 0.1} L${cx + halfAt(bottom) - wall * 1.2} ${bottom - base * 1.4}" stroke="#000" stroke-opacity="0.07" stroke-width="${w * 0.02}" stroke-linecap="round"/>
  ${drops}
  ${trails}
  <ellipse cx="${cx}" cy="${top}" rx="${w / 2}" ry="${w * 0.05}" fill="none" stroke="#fff" stroke-opacity="0.95" stroke-width="${w * 0.014}"/>
  ${onTop}`;
}

// The flavour-specific garnish for each poured glass: the rim wheel plus the named ingredients.
function garnish(f, g) {
  const {cx, top, w, h, liquidTop} = g;
  const rimWheel = (r) => `<g transform="translate(${cx + w / 2 - r * 0.2} ${top + r * 0.12}) rotate(12)">${slice(r, f.peel, f.flesh)}</g>`;
  switch (f.tag) {
    case 'orange':
      return {
        straw: {x0: cx + w * 0.08, y0: top + h * 0.8, x1: cx - w * 0.3, y1: top - h * 0.28, color: f.accent},
        inside: `<g transform="translate(${cx - w * 0.12} ${liquidTop + h * 0.42}) rotate(20)" opacity="0.9">${gingerSlice(w * 0.1)}</g>`,
        onTop: rimWheel(w * 0.27),
        table: `<g transform="translate(330 1760)">${wholeFruit(120, '#ff8a1f', 'round', true)}</g>
          <g transform="translate(560 1860) rotate(-15)">${gingerSlice(62)}</g>
          <g transform="translate(470 1640) rotate(25)">${gingerSlice(48)}</g>
          <g transform="translate(1690 1890) rotate(10)">${gingerSlice(54)}</g>`,
      };
    case 'grapefruit':
      return {
        straw: {x0: cx + w * 0.08, y0: top + h * 0.8, x1: cx - w * 0.3, y1: top - h * 0.28, color: f.accent},
        inside: '',
        onTop: `${rimWheel(w * 0.3)}<g transform="translate(${cx - w * 0.36} ${top + w * 0.02}) rotate(-20)">${hibiscus(w * 0.2, `${f.handle}-rim`)}</g>`,
        table: `<g transform="translate(340 1740) rotate(-15)">${slice(150, f.peel, f.flesh)}</g>
          <g transform="translate(560 1870) rotate(30)">${hibiscus(95, `${f.handle}-t1`)}</g>
          <g transform="translate(1700 1880) rotate(-40)">${hibiscus(70, `${f.handle}-t2`)}</g>`,
      };
    case 'lemon':
      return {
        straw: null,
        behindLiquid: `<g transform="translate(${cx - w * 0.08} ${top + h * 0.7}) rotate(-12)">${mintSprig(h * 0.92)}</g>`,
        inside: `<g transform="translate(${cx - w * 0.22} ${liquidTop + h * 0.5}) rotate(-60)" opacity="0.85">${leaf(w * 0.2)}</g>`,
        onTop: rimWheel(w * 0.27),
        table: `<g transform="translate(330 1760) rotate(-12)">${wholeFruit(105, '#ffd23f', 'lemon')}</g>
          <g transform="translate(560 1880) rotate(-20)">${leaf(110)}</g>
          <g transform="translate(600 1830) rotate(-70)">${leaf(90, MINT_DARK)}</g>
          <g transform="translate(1680 1900) rotate(15)">${leaf(100)}</g>`,
      };
    case 'lime':
      return {
        straw: {x0: cx + w * 0.12, y0: top + h * 0.8, x1: cx - w * 0.28, y1: top - h * 0.28, color: f.accent},
        inside: `<g opacity="0.9"><g transform="translate(${cx - w * 0.17} ${liquidTop + h * 0.36}) rotate(-8) scale(0.55 1)">${cucumberSlice(w * 0.15)}</g>
          <g transform="translate(${cx + w * 0.16} ${liquidTop + h * 0.58}) rotate(10) scale(0.6 1)">${cucumberSlice(w * 0.14)}</g></g>`,
        onTop: rimWheel(w * 0.27),
        table: `<g transform="translate(330 1760)">${wholeFruit(105, '#6fb33a', 'round', true)}</g>
          <g transform="translate(560 1870)">${cucumberSlice(72)}</g>
          <g transform="translate(470 1650)">${cucumberSlice(52)}</g>
          <g transform="translate(1700 1890)">${cucumberSlice(58)}</g>`,
      };
    default:
      return {straw: null, inside: '', onTop: rimWheel(w * 0.27), table: ''};
  }
}

function glassGeometry(cx, bottom, w, h) {
  const top = bottom - h;
  return {cx, bottom, w, h, top, liquidTop: top + h * 0.17};
}

function pourScene({bg, bgLight, decor, content}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000" viewBox="0 0 2000 2000">
  <defs>
    <radialGradient id="bg" cx="45%" cy="35%" r="80%"><stop offset="0" stop-color="${bgLight}"/><stop offset="1" stop-color="${bg}"/></radialGradient>
    <radialGradient id="shadow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#5a3a28" stop-opacity="0.3"/><stop offset="1" stop-color="#5a3a28" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="2000" height="2000" fill="url(#bg)"/>
  <rect y="1700" width="2000" height="300" fill="#fff" opacity="0.3"/>
  <rect y="1700" width="2000" height="6" fill="#fff" opacity="0.6"/>
  ${decor}
  <ellipse cx="1100" cy="1850" rx="820" ry="80" fill="url(#shadow)"/>
  ${content}
</svg>`;
}

function pourImage(f) {
  const g = glassGeometry(860, 1840, 560, 1060);
  const gar = garnish(f, g);
  const decor = [
    bubble(1700, 330, 64, f.accent),
    bubble(1840, 600, 30, f.accent),
    bubble(250, 420, 46, f.accent),
    bubble(420, 250, 24, f.accent),
    sparkle(1420, 240, 80, f.accent),
    sparkle(560, 560, 56, '#ffd23f'),
  ].join('');
  const content = [
    placedCan(f, `pour-${f.handle}`, {cx: 1450, bottom: 1800, scale: 2.25, tilt: 3}),
    pouredGlass(f, `glass-${f.handle}`, {...g, straw: gar.straw, inside: gar.inside, behindLiquid: gar.behindLiquid ?? '', onTop: gar.onTop}),
    gar.table,
  ].join('');
  return pourScene({bg: f.bg, bgLight: f.bgLight, decor, content});
}

function varietyPourImage() {
  const content = FLAVOURS.map((f, i) => {
    const g = glassGeometry(395 + i * 404, 1830, 360, 900);
    const r = g.w * 0.3;
    const wheel = `<g transform="translate(${g.cx + g.w / 2 - r * 0.2} ${g.top + r * 0.12}) rotate(12)">${slice(r, f.peel, f.flesh)}</g>`;
    const straw = i % 2 === 0 ? {x0: g.cx + g.w * 0.1, y0: g.top + g.h * 0.8, x1: g.cx - g.w * 0.28, y1: g.top - g.h * 0.3, color: f.accent} : null;
    return pouredGlass(f, `vglass-${i}`, {...g, straw, onTop: wheel});
  }).join('');
  const decor = [
    `<g transform="translate(300 420) rotate(-20)" opacity="0.9">${slice(120, FLAVOURS[0].peel, FLAVOURS[0].flesh)}</g>`,
    `<g transform="translate(1700 380) rotate(15)" opacity="0.9">${slice(110, FLAVOURS[3].peel, FLAVOURS[3].flesh)}</g>`,
    `<g transform="translate(1000 330) rotate(-8)" opacity="0.9">${slice(90, FLAVOURS[1].peel, FLAVOURS[1].flesh)}</g>`,
    bubble(660, 520, 50, '#e0560e'),
    bubble(1360, 560, 40, '#3f7f14'),
    sparkle(1220, 200, 70, '#d93a4a'),
    sparkle(760, 180, 56, '#ffd23f'),
  ].join('');
  return pourScene({bg: '#ffe7b8', bgLight: '#fff8ea', decor, content});
}

// ---------- render ----------

mkdirSync(IMG_DIR, {recursive: true});
const render = (svg, file) => {
  const png = new Resvg(svg, {
    fitTo: {mode: 'width', value: 2000},
    font: {fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Fredoka'},
  })
    .render()
    .asPng();
  writeFileSync(join(IMG_DIR, file), png);
  return `${file} (${Math.round(png.length / 1024)} KB)`;
};

const images = {};
for (const f of FLAVOURS) images[f.handle] = render(flavourImage(f), `sunfizz-${f.handle}.png`);
images['sunfizz-variety-pack'] = render(varietyImage(), 'sunfizz-variety-pack.png');
for (const f of FLAVOURS) images[`${f.handle}-pour`] = render(pourImage(f), `sunfizz-${f.handle}-poured.png`);
images['sunfizz-variety-pack-pour'] = render(varietyPourImage(), 'sunfizz-variety-pack-poured.png');

// ---------- CSV (Shopify's current product CSV format) ----------

const COLUMNS = [
  'Title', 'URL handle', 'Description', 'Vendor', 'Type', 'Tags', 'Published on online store', 'Status',
  'SKU', 'Option1 name', 'Option1 value', 'Price', 'Compare-at price', 'Charge tax', 'Inventory tracker',
  'Inventory quantity', 'Continue selling when out of stock', 'Weight value (grams)', 'Weight unit for display',
  'Requires shipping', 'Fulfillment service', 'Product image URL', 'Image position', 'Image alt text', 'Gift card',
  'SEO title', 'SEO description',
];
const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const FLAVOUR_PACKS = [
  {value: '4-pack', price: 1600, compare: '', grams: 1500, sku: '04'},
  {value: '12-pack', price: 4500, compare: '', grams: 4500, sku: '12'},
  {value: '24-pack', price: 8500, compare: 9600, grams: 9000, sku: '24'},
];
const VARIETY_PACKS = [
  {value: '12-pack (3 of each)', price: 4800, compare: '', grams: 4500, sku: '12'},
  {value: '24-pack (6 of each)', price: 8900, compare: 9600, grams: 9000, sku: '24'},
];
const FACTS =
  '<ul><li>Real cold-pressed fruit juice</li><li>9g prebiotic plant fibre per can</li><li>Only 5g of sugar and zero sweeteners</li><li>330 ml cans, best served ice-cold</li></ul>';

const products = [
  ...FLAVOURS.map((f) => ({
    handle: f.handle,
    title: f.title,
    description: `<p>${f.blurb}</p><p><strong>Flavour:</strong> ${f.notes}</p>${FACTS}`,
    tags: `sunfizz, sparkling tonic, prebiotic, ${f.tag}`,
    image: `sunfizz-${f.handle}.png`,
    alt: `A can of Sunfizz ${f.title} sparkling tonic`,
    pour: `sunfizz-${f.handle}-poured.png`,
    pourAlt: `A glass of Sunfizz ${f.title} poured over ice`,
    skuBase: `SF-${f.tag.toUpperCase()}`,
    packs: FLAVOUR_PACKS,
    seo: `${f.title}: ${f.notes.toLowerCase()} in a sparkling prebiotic tonic with just 5g of sugar.`,
  })),
  {
    handle: 'sunfizz-variety-pack',
    title: 'Sunfizz Variety Pack',
    description: `<p>Can't pick a favourite? Get all four: Citrus Sunrise, Pink Grapefruit Glow, Lemon Zest and Lime Crush.</p>${FACTS}`,
    tags: 'sunfizz, sparkling tonic, prebiotic, variety',
    image: 'sunfizz-variety-pack.png',
    alt: 'Four cans of Sunfizz: Citrus Sunrise, Pink Grapefruit Glow, Lemon Zest and Lime Crush',
    pour: 'sunfizz-variety-pack-poured.png',
    pourAlt: 'Four glasses of Sunfizz poured over ice, one of each flavour',
    skuBase: 'SF-VARIETY',
    packs: VARIETY_PACKS,
    seo: 'All four Sunfizz sparkling prebiotic tonics in one mixed pack.',
  },
];

const rows = [COLUMNS];
for (const p of products) {
  p.packs.forEach((pack, i) => {
    const first = i === 0;
    const row = {
      Title: first ? p.title : '',
      'URL handle': p.handle,
      Description: first ? p.description : '',
      Vendor: first ? 'Sunfizz' : '',
      Type: first ? 'Sparkling tonic' : '',
      Tags: first ? p.tags : '',
      'Published on online store': first ? 'true' : '',
      Status: first ? 'active' : '',
      SKU: `${p.skuBase}-${pack.sku}`,
      'Option1 name': first ? 'Pack size' : '',
      'Option1 value': pack.value,
      Price: pack.price.toFixed(2),
      'Compare-at price': pack.compare ? pack.compare.toFixed(2) : '',
      'Charge tax': 'true',
      'Inventory tracker': 'shopify',
      'Inventory quantity': 100,
      'Continue selling when out of stock': 'deny',
      'Weight value (grams)': pack.grams,
      'Weight unit for display': 'kg',
      'Requires shipping': 'true',
      'Fulfillment service': 'manual',
      // Image columns are independent of the variant columns: image 1 rides on the first row, image 2 on the second.
      'Product image URL': first ? CDN + p.image : i === 1 ? CDN + p.pour : '',
      'Image position': first ? 1 : i === 1 ? 2 : '',
      'Image alt text': first ? p.alt : i === 1 ? p.pourAlt : '',
      'Gift card': first ? 'false' : '',
      'SEO title': first ? `${p.title} | Sunfizz` : '',
      'SEO description': first ? p.seo : '',
    };
    rows.push(COLUMNS.map((c) => row[c]));
  });
}
writeFileSync(join(OUT, 'sunfizz-products.csv'), rows.map((r) => r.map(esc).join(',')).join('\n') + '\n');

console.log('images:', Object.values(images).join(', '));
console.log('csv rows (incl. header):', rows.length);
