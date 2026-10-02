import {useEffect, useRef, type CSSProperties, type ReactNode} from 'react';
import {EASE, gsap, MOTION_OK, ScrollTrigger} from '~/lib/motion';

type ShapeKind = 'blob' | 'planet' | 'moon' | 'star' | 'bubble';

type Shape = {
  kind: ShapeKind;
  color: string;
  /** Left / top edge as a % of the stage, so the layout scales with it. */
  x: number;
  y: number;
  /** Width in px at desktop size (home.css scales it down on small screens). */
  size: number;
  opacity: number;
  /** Blob outline seed: the same seed draws the same outline on server and client. */
  seed?: number;
  desktopOnly?: boolean;
};

type Layer = {
  /**
   * Scroll speed relative to the page: 1 moves with the copy, below 1 lags
   * behind it (reads as far away), above 1 overtakes it (reads as near).
   */
  speed: number;
  shapes: Shape[];
};

const LAYERS: Layer[] = [
  {
    // Far: big soft blobs, slowest.
    speed: 0.45,
    shapes: [
      {kind: 'blob', seed: 3, color: 'var(--sf-lemon)', x: -8, y: -3, size: 460, opacity: 0.45},
      {kind: 'blob', seed: 11, color: 'var(--sf-peach)', x: 58, y: 3, size: 540, opacity: 0.4},
      {kind: 'blob', seed: 7, color: 'var(--sf-lime)', x: 3, y: 58, size: 400, opacity: 0.3},
      {kind: 'blob', seed: 19, color: 'var(--sf-grapefruit)', x: 74, y: 66, size: 320, opacity: 0.18, desktopOnly: true},
    ],
  },
  {
    // Mid: the planet and a small moon.
    speed: 0.7,
    shapes: [
      {kind: 'planet', color: 'var(--sf-lemon)', x: 69, y: 43, size: 230, opacity: 0.9},
      {kind: 'moon', color: 'var(--sf-tangerine)', x: 12, y: 40, size: 64, opacity: 0.55},
    ],
  },
  {
    // Near: sparkles.
    speed: 0.9,
    shapes: [
      {kind: 'star', color: 'var(--sf-tangerine)', x: 16, y: 7, size: 28, opacity: 0.8},
      {kind: 'star', color: 'var(--sf-lemon)', x: 47, y: 4, size: 20, opacity: 0.9},
      {kind: 'star', color: 'var(--sf-grapefruit)', x: 91, y: 12, size: 32, opacity: 0.7},
      {kind: 'star', color: 'var(--sf-tangerine)', x: 38, y: 38, size: 16, opacity: 0.7, desktopOnly: true},
      {kind: 'star', color: 'var(--sf-lemon)', x: 57, y: 60, size: 24, opacity: 0.85},
      {kind: 'star', color: 'var(--sf-grapefruit)', x: 26, y: 84, size: 20, opacity: 0.7, desktopOnly: true},
    ],
  },
  {
    // Front: fizz bubbles rise faster than the page.
    speed: 1.3,
    shapes: [
      {kind: 'bubble', color: 'var(--sf-tangerine)', x: 8, y: 22, size: 34, opacity: 0.7},
      {kind: 'bubble', color: 'var(--sf-grapefruit)', x: 30, y: 52, size: 18, opacity: 0.6},
      {kind: 'bubble', color: 'var(--sf-lime)', x: 44, y: 30, size: 26, opacity: 0.65, desktopOnly: true},
      {kind: 'bubble', color: 'var(--sf-tangerine)', x: 62, y: 16, size: 14, opacity: 0.7},
      {kind: 'bubble', color: 'var(--sf-grapefruit)', x: 84, y: 34, size: 40, opacity: 0.55},
      {kind: 'bubble', color: 'var(--sf-lime)', x: 94, y: 62, size: 22, opacity: 0.65},
      {kind: 'bubble', color: 'var(--sf-tangerine)', x: 50, y: 76, size: 30, opacity: 0.6},
      {kind: 'bubble', color: 'var(--sf-lemon)', x: 70, y: 90, size: 16, opacity: 0.8, desktopOnly: true},
      {kind: 'bubble', color: 'var(--sf-grapefruit)', x: 16, y: 94, size: 24, opacity: 0.6},
    ],
  },
];

/** Idle-loop ranges per shape kind: max drift in px / deg, and a base duration range in s. */
const FLOAT: Record<
  ShapeKind,
  {x: number; y: number; rotation: number; scale?: number; duration: [number, number]}
> = {
  blob: {x: 28, y: 22, rotation: 10, duration: [7, 11]},
  planet: {x: 10, y: 18, rotation: 6, duration: [6, 8]},
  moon: {x: 12, y: 14, rotation: 0, duration: [4.5, 6.5]},
  star: {x: 6, y: 8, rotation: 28, scale: 1.25, duration: [2.4, 4.2]},
  bubble: {x: 10, y: 22, rotation: 0, duration: [3.2, 5.4]},
};

/**
 * Hero backdrop: layers of inline SVG shapes behind the page copy. Each layer
 * is scrubbed to scroll at its own speed, and each shape idles on its own loop.
 */
export function ParallaxStage({children}: {children: ReactNode}) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      let cancelled = false;

      // Parallax: one scrubbed timeline for every layer. Over the trigger range
      // the page scrolls stage.offsetHeight px, so a layer at speed s is offset
      // by (1 - s) of that: positive (down) lags, negative (up) overtakes.
      const parallax = gsap.timeline({
        defaults: {ease: 'none'},
        scrollTrigger: {
          trigger: stage,
          start: 'top top',
          end: 'bottom top',
          scrub: true, // Lenis already smooths the scroll; extra scrub lag would feel floaty
          invalidateOnRefresh: true,
        },
      });
      gsap.utils.toArray<HTMLElement>('.parallax-layer', stage).forEach((layer) => {
        const speed = Number(layer.dataset.speed);
        parallax.to(layer, {y: () => (1 - speed) * stage.offsetHeight}, 0);
      });

      // Ambient idle loops on the shapes (the layers own the scroll transform).
      const random = gsap.utils.random;
      const ambient: gsap.core.Tween[] = [];
      gsap.utils
        .toArray<HTMLElement>('[data-float]', stage)
        .filter((el) => el.offsetParent !== null) // skip shapes hidden on this breakpoint
        .forEach((el, i) => {
          const preset = FLOAT[el.dataset.float as ShapeKind];
          const base = random(preset.duration[0], preset.duration[1]);
          const loop = {
            ease: EASE.idle,
            repeat: -1,
            yoyo: true,
            delay: i * 0.15 + random(0, 0.6), // staggered, jittered starts
          };
          // Every axis gets its own duration, so the combined path never repeats in step.
          ambient.push(
            gsap.to(el, {x: random(-preset.x, preset.x), duration: base, ...loop}),
            gsap.to(el, {
              y: random(-preset.y, preset.y),
              duration: base * random(0.6, 0.85),
              ...loop,
            }),
          );
          if (preset.rotation) {
            ambient.push(
              gsap.to(el, {
                rotation: random(-preset.rotation, preset.rotation),
                duration: base * random(1.1, 1.5),
                ...loop,
              }),
            );
          }
          if (preset.scale) {
            ambient.push(
              gsap.to(el, {scale: preset.scale, duration: base * 0.5, ...loop}),
            );
          }
        });

      // No point animating what nobody can see: pause the loops off-screen.
      ScrollTrigger.create({
        trigger: stage,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          ambient.forEach((tween) => {
            tween.paused(!self.isActive);
          });
        },
      });

      // Font swaps change the stage height; re-measure once they've settled.
      void document.fonts.ready.then(() => {
        if (!cancelled) ScrollTrigger.refresh();
      });

      return () => {
        cancelled = true;
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <div className="parallax-stage" ref={stageRef}>
      <div className="parallax-backdrop" aria-hidden="true">
        {LAYERS.map((layer) => (
          <div
            className="parallax-layer"
            data-speed={layer.speed}
            key={layer.speed}
          >
            {layer.shapes.map((shape) => (
              <div
                key={`${shape.kind}-${shape.x}-${shape.y}`}
                className={`parallax-shape parallax-shape--${shape.kind}`}
                data-float={shape.kind}
                data-desktop-only={shape.desktopOnly || undefined}
                style={
                  {
                    left: `${shape.x}%`,
                    top: `${shape.y}%`,
                    opacity: shape.opacity,
                    color: shape.color,
                    '--size': `${shape.size}px`,
                  } as CSSProperties
                }
              >
                <ShapeArt shape={shape} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="parallax-content">{children}</div>
    </div>
  );
}

function ShapeArt({shape}: {shape: Shape}) {
  switch (shape.kind) {
    case 'blob':
      return (
        <svg viewBox="-10 -10 120 120">
          <path d={blobPath(shape.seed ?? 1)} fill="currentColor" />
        </svg>
      );
    case 'planet':
      return <PlanetArt />;
    case 'moon':
      return (
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="currentColor" />
          <circle cx="35" cy="34" r="11" fill="#fff" opacity="0.35" />
          <circle cx="62" cy="64" r="7" fill="#000" opacity="0.08" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 100 100">
          <path d={STAR_PATH} fill="currentColor" />
        </svg>
      );
    case 'bubble':
      return (
        <svg viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="currentColor"
            fillOpacity="0.16"
            stroke="currentColor"
            strokeWidth="5"
          />
          <path
            d="M29 36 A24 24 0 0 1 47 22"
            fill="none"
            stroke="#fff"
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
      );
  }
}

function PlanetArt() {
  // The ring is drawn twice: its back half before the planet, its front half after.
  return (
    <svg viewBox="0 0 160 110">
      <defs>
        <radialGradient id="sf-planet" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.5" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#ff9f2e" />
        </radialGradient>
      </defs>
      <g transform="rotate(-16 80 55)">
        <ellipse cx="80" cy="55" rx="72" ry="15" fill="none" stroke="#ffb38a" strokeWidth="6" />
      </g>
      <circle cx="80" cy="55" r="36" fill="url(#sf-planet)" />
      <path
        d="M54 46 C66 40 94 40 106 48"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.35"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g transform="rotate(-16 80 55)">
        <path d="M8 55 A72 15 0 0 0 152 55" fill="none" stroke="#ffb38a" strokeWidth="6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// Four-point sparkle.
const STAR_PATH =
  'M50 0 C54 36 64 46 100 50 C64 54 54 64 50 100 C46 64 36 54 0 50 C36 46 46 36 50 0 Z';

/** Seeded PRNG (mulberry32): deterministic, so SSR and hydration draw identical shapes. */
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth closed blob in a 100×100 box: jittered radii joined with Catmull-Rom curves. */
function blobPath(seed: number, points = 7, variance = 0.32) {
  const rand = mulberry32(seed);
  const pts = Array.from({length: points}, (_, i) => {
    const angle = (i / points) * Math.PI * 2;
    const radius = 50 * (1 - variance / 2 + rand() * variance);
    return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
  });
  const at = (i: number) => pts[(i + points) % points];
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < points; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return `${d} Z`;
}
