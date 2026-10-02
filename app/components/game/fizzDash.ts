/**
 * Fizz Dash: the footer's mini-game. A Sunfizz can runs along the bar, hops
 * ice cubes, straws and rolling lemon wheels, and collects soda bubbles.
 *
 * Plain canvas 2D, no dependencies. FooterGame (the React wrapper) imports this
 * module only when the footer nears the viewport, and nothing here runs until
 * a game starts: the requestAnimationFrame loop exists only while the state is
 * 'running', and destroy() leaves no loop, observer or listener behind.
 *
 * World units are CSS pixels; the canvas backing store follows the device
 * pixel ratio (capped at 2). Heights ("lift", obstacle and bubble y) are
 * measured up from the ground line.
 */

export type GameState = 'idle' | 'running' | 'paused' | 'over';
export type GameInfo = {score: number; best: number; newBest: boolean};

export type FizzDashOptions = {
  canvas: HTMLCanvasElement;
  best?: number;
  /** Minimal effects: no background fizz, squash, tilt, rolling or pop rings. */
  reducedMotion?: boolean;
  onStateChange?: (state: GameState, info: GameInfo) => void;
};

export type FizzDash = ReturnType<typeof createFizzDash>;

const GROUND = 26; // ground line, px above the bottom edge
const CAN = {w: 24, h: 40};
const GRAVITY = 2600; // px/s²
const JUMP_SPEED = 680; // px/s: about 89px high and 0.52s in the air
const JUMP_BUFFER = 0.12; // s: a press just before landing still jumps
const SPEED = {start: 300, max: 560, ramp: 6}; // px/s; ramp = px/s gained per second
const GAP = {min: 0.85, max: 1.7}; // seconds of running between obstacles
const BUBBLE_POINTS = 5;
const PX_PER_POINT = 100; // distance points: one per 100px run
const HARD_FROM = 40; // score at which double ice cubes join in
const RESTART_GRACE = 400; // ms after a crash before a restart is accepted
const MAX_STEP = 1 / 30; // s: a long frame slows the game rather than skipping through an obstacle
const MAX_DPR = 2;

type Kind = 'ice' | 'stack' | 'straw' | 'lemon';
const SIZE: Record<Kind, {w: number; h: number}> = {
  ice: {w: 28, h: 28},
  stack: {w: 30, h: 54},
  straw: {w: 10, h: 50},
  lemon: {w: 30, h: 30},
};

type Obstacle = {kind: Kind; x: number; w: number; h: number};
/** popped: seconds since it was collected, -1 while still up for grabs. */
type Bubble = {x: number; y: number; r: number; popped: number};
/** Background fizz: decorative bubbles rising behind the run. */
type Fizz = {x: number; y: number; r: number; v: number; fill: string};

function brandColours() {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;
  return {
    cream: token('--sf-cream', '#fff7e8'),
    lemon: token('--sf-lemon', '#ffd23f'),
    tangerine: token('--sf-tangerine', '#ff7a1a'),
    grapefruit: token('--sf-grapefruit', '#ff5a5f'),
  };
}

export function createFizzDash({
  canvas,
  best: initialBest = 0,
  reducedMotion = false,
  onStateChange,
}: FizzDashOptions) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is not available');
  const ctx = context; // a non-null const, so the drawing helpers below see it typed
  const colours = brandColours();

  let state: GameState = 'idle';
  let reduced = reducedMotion;
  let width = 0;
  let height = 0;
  let groundY = 0;
  let canX = 0;
  let speedScale = 1;

  // One run
  let speed = SPEED.start;
  let distance = 0;
  let bubbles = 0;
  let score = 0;
  let best = initialBest;
  let lift = 0;
  let vy = 0;
  let onGround = true;
  let jumpBuffer = 0;
  let squash = 0;
  let spin = 0;
  let untilSpawn = 0;
  let crashedAt = 0;
  let obstacles: Obstacle[] = [];
  let pickups: Bubble[] = [];
  const fizz: Fizz[] = [];

  let raf = 0;
  let last = 0;

  const random = (min: number, max: number) => min + Math.random() * (max - min);

  function setState(next: GameState, newBest = false) {
    state = next;
    onStateChange?.(next, {score, best, newBest});
  }

  // --- Sizing ---------------------------------------------------------------

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = height - GROUND;
    canX = Math.max(36, width * 0.12);
    // Narrow screens run slower, so obstacles still give a fair warning.
    speedScale = Math.min(1, Math.max(0.7, width / 900));
    if (!fizz.length) seedFizz();
    if (state === 'idle') posterScene();
    if (state !== 'running') draw(); // while running, the next frame redraws anyway
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize(); // first poster frame now, not on the observer's next tick

  // --- Scene set-up ----------------------------------------------------------

  /** The still frame shown before a game: a can, an ice cube, a lemon wheel, a few bubbles. */
  function posterScene() {
    lift = 0;
    vy = 0;
    onGround = true;
    squash = 0;
    obstacles = [
      {kind: 'ice', x: width * 0.6, ...SIZE.ice},
      {kind: 'lemon', x: width * 0.84, ...SIZE.lemon},
    ];
    pickups = [-1, 0, 1].map((i) => ({
      x: width * 0.72 + i * 24,
      y: 46 + (i === 0 ? 8 : 0),
      r: 7,
      popped: -1,
    }));
  }

  function newRun() {
    speed = SPEED.start;
    distance = 0;
    bubbles = 0;
    score = 0;
    lift = 0;
    vy = 0;
    onGround = true;
    jumpBuffer = 0;
    squash = 0;
    obstacles = [];
    pickups = [];
    untilSpawn = width * 0.5; // a short run-up before the first obstacle
  }

  function seedFizz() {
    for (let i = 0; i < 14; i++) {
      fizz.push({
        x: random(0, width),
        y: random(0, height),
        r: random(1.5, 4),
        v: random(10, 26),
        fill: `rgba(255, 247, 232, ${random(0.08, 0.22).toFixed(2)})`,
      });
    }
  }

  function spawn() {
    const kinds: Kind[] =
      score >= HARD_FROM ? ['ice', 'ice', 'straw', 'lemon', 'stack'] : ['ice', 'ice', 'straw', 'lemon'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const x = width + SIZE[kind].w;
    obstacles.push({kind, x, ...SIZE[kind]});

    const gap = speed * speedScale * random(GAP.min, GAP.max);
    untilSpawn = gap;

    // Bubbles in about half the gaps: a low line to run through or a high arc to jump for.
    if (Math.random() < 0.55) {
      const count = 1 + Math.floor(Math.random() * 3);
      const high = Math.random() < 0.6;
      const middle = x + SIZE[kind].w + gap / 2;
      for (let i = 0; i < count; i++) {
        const offset = i - (count - 1) / 2;
        pickups.push({
          x: middle + offset * 26,
          y: high ? 78 - Math.abs(offset) * 10 : 20,
          r: 7,
          popped: -1,
        });
      }
    }
  }

  // --- Simulation ------------------------------------------------------------

  function hits(o: Obstacle) {
    const inset = o.kind === 'lemon' ? 5 : 3; // forgiving hitboxes feel fair
    return (
      canX + CAN.w - 3 > o.x + inset &&
      canX + 3 < o.x + o.w - inset &&
      lift < o.h - inset
    );
  }

  function touches(b: Bubble) {
    const dx = Math.abs(b.x - (canX + CAN.w / 2));
    const dy = Math.abs(b.y - (lift + CAN.h / 2));
    return dx < CAN.w / 2 + b.r && dy < CAN.h / 2 + b.r;
  }

  function step(dt: number) {
    speed = Math.min(SPEED.max, speed + SPEED.ramp * dt);
    const move = speed * speedScale * dt;
    distance += speed * dt;

    // The can: buffered jump, gravity, a squash on landing.
    if (jumpBuffer > 0) {
      jumpBuffer -= dt;
      if (onGround) {
        vy = JUMP_SPEED;
        onGround = false;
        jumpBuffer = 0;
      }
    }
    if (!onGround) {
      vy -= GRAVITY * dt;
      lift += vy * dt;
      if (lift <= 0) {
        lift = 0;
        vy = 0;
        onGround = true;
        squash = reduced ? 0 : 1;
      }
    }
    squash = Math.max(0, squash - dt * 8);

    // The world slides left.
    untilSpawn -= move;
    if (untilSpawn <= 0) spawn();
    for (const o of obstacles) o.x -= move;
    obstacles = obstacles.filter((o) => o.x + o.w > -20);
    for (const b of pickups) {
      b.x -= move;
      if (b.popped >= 0) b.popped += dt;
    }
    pickups = pickups.filter((b) => b.x > -20 && b.popped < 0.3);
    if (!reduced) {
      spin -= move / (SIZE.lemon.w / 2); // lemon wheels roll along the ground
      for (const f of fizz) {
        f.y -= f.v * dt;
        f.x -= move * 0.15; // far away: drifts slower than the ground
        if (f.y < -5) f.y = height + 5;
        if (f.x < -5) f.x += width + 10;
      }
    }

    for (const b of pickups) {
      if (b.popped < 0 && touches(b)) {
        b.popped = 0;
        bubbles += 1;
      }
    }
    score = Math.floor(distance / PX_PER_POINT) + bubbles * BUBBLE_POINTS;
    if (obstacles.some(hits)) crash();
  }

  function crash() {
    stopLoop();
    crashedAt = performance.now();
    const newBest = score > best;
    best = Math.max(best, score);
    state = 'over';
    draw();
    setState('over', newBest);
  }

  // --- Loop: only exists while running ------------------------------------------

  function frame(time: number) {
    raf = 0;
    if (state !== 'running') return;
    const dt = Math.min((time - last) / 1000, MAX_STEP);
    last = time;
    step(Math.max(0, dt));
    draw();
    if (state === 'running') raf = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // --- Drawing ---------------------------------------------------------------

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function circle(x: number, y: number, r: number) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }

  function drawGround() {
    const c = ctx;
    c.fillStyle = 'rgba(255, 247, 232, 0.28)';
    c.fillRect(0, groundY, width, 2);
    // Dashes under the line sell the speed (still under reduced motion).
    const offset = reduced ? 0 : (distance * speedScale) % 38;
    c.fillStyle = 'rgba(255, 247, 232, 0.14)';
    for (let x = -offset; x < width; x += 38) c.fillRect(x, groundY + 9, 16, 2);
  }

  function drawFizz() {
    const c = ctx;
    for (const f of fizz) {
      c.fillStyle = f.fill;
      circle(f.x, f.y, f.r);
      c.fill();
    }
  }

  function drawCan() {
    const c = ctx;
    const x = canX + CAN.w / 2;
    const y = groundY - lift;

    // Shadow: shrinks as the can rises.
    const s = Math.max(0.35, 1 - lift / 120);
    c.fillStyle = 'rgba(0, 0, 0, 0.28)';
    c.beginPath();
    c.ellipse(x, groundY + 1, 13 * s, 3 * s, 0, 0, Math.PI * 2);
    c.fill();

    let tilt = 0;
    if (!reduced) {
      if (state === 'over') tilt = -0.45; // knocked back
      else if (!onGround) tilt = Math.max(-0.16, Math.min(0.16, -vy / 4200));
    }
    c.save();
    c.translate(x, y);
    c.rotate(tilt);
    c.scale(1 + squash * 0.14, 1 - squash * 0.14);
    const w = CAN.w;
    const h = CAN.h;
    const left = -w / 2;
    // Body, rims, label band, lemon mark, shine.
    c.fillStyle = colours.tangerine;
    roundRect(left, -h, w, h, 5);
    c.fill();
    c.fillStyle = '#e9e3da';
    roundRect(left + 1.5, -h - 1.5, w - 3, 4, 2);
    c.fill();
    roundRect(left + 1.5, -3, w - 3, 3, 1.5);
    c.fill();
    c.fillStyle = colours.cream;
    c.fillRect(left, -h * 0.64, w, h * 0.3);
    c.fillStyle = colours.lemon;
    circle(0, -h * 0.49, 3.6);
    c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.35)';
    c.fillRect(left + 4, -h + 5, 2.5, h - 10);
    c.restore();
  }

  function drawIce(o: Obstacle) {
    const c = ctx;
    const cubes = o.kind === 'stack' ? 2 : 1;
    const size = o.h / cubes;
    for (let i = 0; i < cubes; i++) {
      const x = o.x + (i === 1 ? 2 : 0);
      const y = groundY - size * (i + 1);
      c.fillStyle = 'rgba(214, 238, 255, 0.9)';
      c.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      c.lineWidth = 1.5;
      roundRect(x, y, o.w - 2, size - 1, 5);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(255, 255, 255, 0.8)';
      roundRect(x + 4, y + 4, 8, 5, 2.5);
      c.fill();
    }
  }

  function drawStraw(o: Obstacle) {
    const c = ctx;
    const top = groundY - o.h;
    for (let y = top, i = 0; y < groundY; y += 8, i++) {
      c.fillStyle = i % 2 ? colours.cream : colours.grapefruit;
      c.fillRect(o.x, y, o.w, Math.min(8, groundY - y));
    }
    // The bendy tip.
    c.strokeStyle = colours.grapefruit;
    c.lineWidth = o.w * 0.8;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(o.x + o.w / 2, top + 2);
    c.lineTo(o.x + o.w / 2 + 9, top - 8);
    c.stroke();
  }

  function drawLemon(o: Obstacle) {
    const c = ctx;
    const r = o.w / 2;
    const x = o.x + r;
    const y = groundY - r;
    c.fillStyle = '#f2b929';
    circle(x, y, r);
    c.fill();
    c.fillStyle = '#fff4c2';
    circle(x, y, r - 2.5);
    c.fill();
    c.fillStyle = colours.lemon;
    circle(x, y, r - 4.5);
    c.fill();
    c.strokeStyle = '#fff4c2';
    c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = spin + (i * Math.PI) / 4;
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * (r - 4.5), y + Math.sin(a) * (r - 4.5));
    }
    c.stroke();
  }

  function drawBubble(b: Bubble) {
    const c = ctx;
    const x = b.x;
    const y = groundY - b.y;
    if (b.popped >= 0) {
      if (reduced) return;
      const t = b.popped / 0.3; // a ring that grows and fades
      c.strokeStyle = `rgba(255, 255, 255, ${1 - t})`;
      c.lineWidth = 1.5;
      circle(x, y, b.r + t * 10);
      c.stroke();
      return;
    }
    c.fillStyle = 'rgba(255, 255, 255, 0.18)';
    c.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    c.lineWidth = 1.5;
    circle(x, y, b.r);
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(255, 255, 255, 0.85)';
    circle(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.28);
    c.fill();
  }

  function drawHud() {
    // Only mid-game: before and after a run the page's own overlay says it all.
    if (state !== 'running' && state !== 'paused') return;
    const c = ctx;
    c.font = '600 14px "Fredoka Variable", ui-rounded, system-ui, sans-serif';
    c.textBaseline = 'top';
    c.fillStyle = 'rgba(255, 247, 232, 0.9)';
    c.textAlign = 'right'; // top right: the can jumps up on the left
    c.fillText(best > 0 ? `Fizz ${score}   Best ${best}` : `Fizz ${score}`, width - 14, 12);
  }

  function draw() {
    const c = ctx;
    c.clearRect(0, 0, width, height);
    if (!reduced) drawFizz();
    drawGround();
    for (const b of pickups) drawBubble(b);
    for (const o of obstacles) {
      if (o.kind === 'straw') drawStraw(o);
      else if (o.kind === 'lemon') drawLemon(o);
      else drawIce(o);
    }
    drawCan();
    drawHud();
  }

  // --- Public API ------------------------------------------------------------

  return {
    get state() {
      return state;
    },
    /** New game (from the poster or after a crash). */
    start() {
      if (state === 'running' || state === 'paused') return;
      if (state === 'over' && performance.now() - crashedAt < RESTART_GRACE) return;
      newRun();
      setState('running');
      startLoop();
    },
    jump() {
      if (state === 'running') jumpBuffer = JUMP_BUFFER;
    },
    pause() {
      if (state !== 'running') return;
      stopLoop();
      state = 'paused';
      draw();
      setState('paused');
    },
    resume() {
      if (state !== 'paused') return;
      setState('running');
      startLoop();
    },
    /** Back to the still poster (e.g. when the visitor navigates to another page). */
    reset() {
      stopLoop();
      const changed = state !== 'idle';
      state = 'idle';
      posterScene();
      draw();
      if (changed) setState('idle');
    },
    setReducedMotion(on: boolean) {
      reduced = on;
      if (state !== 'running') draw();
    },
    destroy() {
      stopLoop();
      resizeObserver.disconnect();
      state = 'idle';
    },
  };
}
