import type {Flavour} from '~/lib/flavours';

/**
 * Draws the printed wrap of a Sunfizz can onto a 2D canvas, for use as the
 * texture of the can body's open cylinder. u = 0.5 faces the camera (front:
 * logo), u = 0 / 1 is the back (info panel, drawn twice so it wraps).
 *
 * Aspect = circumference : body height (2πr : h), so text isn't stretched.
 */
export const LABEL_W = 2048;
export const LABEL_H = 1206; // 2048 × (1.85 / (2π × 0.5)), the body used in CanViewer

const INK = '#2a1409';
const COCOA = '#5a3a28';
const CREAM = '#fff7e8';
const FONT_STACK = '"Fredoka Variable", "Fredoka", ui-rounded, system-ui, sans-serif';

type Ctx = CanvasRenderingContext2D & {letterSpacing?: string};

function font(ctx: Ctx, weight: number, px: number, spacing = 0) {
  ctx.font = `${weight} ${Math.round(px)}px ${FONT_STACK}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
}

function citrusWheel(ctx: Ctx, x: number, y: number, r: number, f: Flavour) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = f.peel;
  ctx.fill();
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = f.flesh;
  ctx.fill();
  ctx.lineWidth = r * 0.1;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(a) * r * 0.72, -Math.cos(a) * r * 0.72);
    ctx.stroke();
  }
  ctx.restore();
}

function pill(ctx: Ctx, cx: number, cy: number, w: number, h: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** The cream label band: wavy top and bottom edges, seamless around the can. */
function band(ctx: Ctx, W: number, H: number) {
  const waves = 3; // whole periods around the can, so u = 0 meets u = 1
  const amp = H * 0.035;
  const top = (x: number) => H * 0.22 + amp * Math.sin((x / W) * Math.PI * 2 * waves);
  const bottom = (x: number) =>
    H * 0.7 + amp * Math.sin((x / W) * Math.PI * 2 * waves + Math.PI);
  ctx.beginPath();
  ctx.moveTo(0, top(0));
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, top(x));
  for (let x = W; x >= 0; x -= 8) ctx.lineTo(x, bottom(x));
  ctx.closePath();
  const g = ctx.createLinearGradient(0, H * 0.2, 0, H * 0.72);
  g.addColorStop(0, '#fffaf1');
  g.addColorStop(1, '#f7ecd8');
  ctx.fillStyle = g;
  ctx.fill();
}

function front(ctx: Ctx, cx: number, H: number, f: Flavour) {
  citrusWheel(ctx, cx, H * 0.315, H * 0.068, f);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 700, H * 0.15, 4);
  ctx.fillStyle = INK;
  ctx.fillText('SUN', cx, H * 0.505);
  ctx.fillStyle = f.accent;
  ctx.fillText('FIZZ', cx, H * 0.645);

  pill(ctx, cx, H * 0.79, 600, H * 0.072, CREAM);
  font(ctx, 600, H * 0.038, 6);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(f.canLabel, cx, H * 0.793);

  font(ctx, 500, H * 0.03, 9);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = f.bodyText;
  ctx.fillText('330 ML · 5G SUGAR', cx, H * 0.9);
  ctx.globalAlpha = 1;
}

function back(ctx: Ctx, cx: number, H: number, f: Flavour) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  font(ctx, 700, H * 0.07, 3);
  ctx.fillStyle = f.accent;
  ctx.fillText('SUNFIZZ', cx, H * 0.33);
  font(ctx, 600, H * 0.032, 5);
  ctx.fillStyle = INK;
  ctx.fillText('SPARKLING PREBIOTIC TONIC', cx, H * 0.41);
  font(ctx, 500, H * 0.034, 1);
  ctx.fillStyle = COCOA;
  ctx.fillText(f.notes, cx, H * 0.48);
  font(ctx, 500, H * 0.027, 4);
  ['REAL COLD-PRESSED JUICE', '9G PREBIOTIC FIBRE', '5G SUGAR · ZERO SWEETENERS'].forEach(
    (line, i) => ctx.fillText(line, cx, H * (0.55 + i * 0.045)),
  );
  font(ctx, 600, H * 0.03, 8);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = f.bodyText;
  ctx.fillText('BEST SERVED ICE-COLD', cx, H * 0.83);
  ctx.globalAlpha = 1;
}

/** Soft white fizz dots on the coloured part, seeded so every can matches. */
function fizzDots(ctx: Ctx, W: number, H: number) {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 26; i++) {
    const x = rand() * W;
    const y = rand() < 0.5 ? H * (0.03 + rand() * 0.13) : H * (0.95 + rand() * 0.03);
    const r = 6 + rand() * 14;
    ctx.globalAlpha = 0.18 + rand() * 0.14;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

let fontsReady: Promise<unknown> | null = null;

/** Draws the label once the display font is available (or after 1.5s). */
export async function drawCanLabel(f: Flavour): Promise<HTMLCanvasElement> {
  fontsReady ??= Promise.race([
    Promise.all(
      [500, 600, 700].map((w) => document.fonts.load(`${w} 64px "Fredoka Variable"`)),
    ).catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
  await fontsReady;

  const canvas = document.createElement('canvas');
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext('2d') as Ctx;
  const W = LABEL_W;
  const H = LABEL_H;

  // Flat body colour top to bottom: the painted shoulder and base use the same
  // colour, so the seams where the label meets them disappear.
  ctx.fillStyle = f.body[1];
  ctx.fillRect(0, 0, W, H);
  fizzDots(ctx, W, H);
  band(ctx, W, H);
  front(ctx, W / 2, H, f);
  back(ctx, 0, H, f);
  back(ctx, W, H, f); // the other half of the wrap-around panel
  return canvas;
}
