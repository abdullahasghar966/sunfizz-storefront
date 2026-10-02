import {useEffect, useRef, type CSSProperties} from 'react';
import {EASE, gsap, MOTION_OK, ScrollTrigger} from '~/lib/motion';

type Kind = 'bubble' | 'wheel' | 'ice' | 'leaf';

type Piece = {
  kind: Kind;
  /** Left / top edge as a % of the backdrop. */
  x: number;
  y: number;
  /** Width in px at desktop size (shop.css scales it down on phones). */
  size: number;
  /** Peel / fill colour. */
  color: string;
  /** Flesh colour for citrus wheels. */
  flesh?: string;
  rotate?: number;
  desktopOnly?: boolean;
};

type Layer = {speed: number; pieces: Piece[]};

// Everything here is something you'd find in (or next to) a glass of Sunfizz.
// Pieces keep to the right half on desktop so the headline stays clear; the
// ones that would sit behind the copy on a phone are desktop-only.
const LAYERS: Layer[] = [
  {
    // Far: slow, soft citrus wheels and an ice cube.
    speed: 0.55,
    pieces: [
      {kind: 'wheel', x: 56, y: 60, size: 120, color: '#ff9f2e', flesh: '#ffc56b', rotate: -18, desktopOnly: true},
      {kind: 'wheel', x: 82, y: 4, size: 150, color: '#8fd14f', flesh: '#d4f39a', rotate: 14},
      {kind: 'ice', x: 66, y: 20, size: 70, color: '#ffffff', rotate: 12, desktopOnly: true},
      {kind: 'wheel', x: 90, y: 62, size: 90, color: '#ff6f73', flesh: '#ffb3b5', rotate: 30, desktopOnly: true},
    ],
  },
  {
    // Near: fizz bubbles and a mint leaf rise faster than the page.
    speed: 1.35,
    pieces: [
      {kind: 'bubble', x: 52, y: 22, size: 34, color: '#ff7a1a'},
      {kind: 'bubble', x: 48, y: 78, size: 18, color: '#ff5a5f', desktopOnly: true},
      {kind: 'bubble', x: 60, y: 8, size: 26, color: '#7cc242'},
      {kind: 'bubble', x: 76, y: 44, size: 16, color: '#d9a300', desktopOnly: true},
      {kind: 'bubble', x: 94, y: 40, size: 30, color: '#ff7a1a'},
      {kind: 'bubble', x: 70, y: 84, size: 22, color: '#7cc242', desktopOnly: true},
      {kind: 'leaf', x: 78, y: 70, size: 64, color: '#3f9d45', rotate: -30, desktopOnly: true},
      {kind: 'wheel', x: 72, y: 30, size: 54, color: '#ffd23f', flesh: '#fff0a3', rotate: 8},
    ],
  },
];

const FLOAT: Record<Kind, {x: number; y: number; rotation: number; duration: [number, number]}> = {
  bubble: {x: 10, y: 22, rotation: 0, duration: [3.2, 5.4]},
  wheel: {x: 14, y: 16, rotation: 24, duration: [6, 9]},
  ice: {x: 8, y: 12, rotation: 16, duration: [5, 7]},
  leaf: {x: 12, y: 14, rotation: 20, duration: [4.5, 6.5]},
};

/**
 * Decorative drink-themed backdrop for the listing header: parallax depth layers
 * (multi-layer-parallax-scroll skill) plus per-axis idle loops
 * (ambient-idle-float-loop skill). Static under reduced motion.
 */
export function FizzBackdrop() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mm = gsap.matchMedia();

    mm.add(MOTION_OK, () => {
      const parallax = gsap.timeline({
        defaults: {ease: 'none'},
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
      gsap.utils.toArray<HTMLElement>('.fizz-layer', root).forEach((layer) => {
        const speed = Number(layer.dataset.speed);
        parallax.to(layer, {y: () => (1 - speed) * root.offsetHeight}, 0);
      });

      const random = gsap.utils.random;
      const ambient: gsap.core.Tween[] = [];
      gsap.utils
        .toArray<HTMLElement>('[data-float]', root)
        .filter((el) => el.offsetParent !== null)
        .forEach((el, i) => {
          const preset = FLOAT[el.dataset.float as Kind];
          const base = random(preset.duration[0], preset.duration[1]);
          const loop = {
            ease: EASE.idle,
            repeat: -1,
            yoyo: true,
            delay: i * 0.15 + random(0, 0.6),
          };
          ambient.push(
            gsap.to(el, {x: random(-preset.x, preset.x), duration: base, ...loop}),
            gsap.to(el, {y: random(-preset.y, preset.y), duration: base * random(0.6, 0.85), ...loop}),
          );
          if (preset.rotation) {
            ambient.push(
              gsap.to(el, {
                rotation: `+=${random(-preset.rotation, preset.rotation)}`,
                duration: base * random(1.1, 1.5),
                ...loop,
              }),
            );
          }
        });

      ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          ambient.forEach((tween) => {
            tween.paused(!self.isActive);
          });
        },
      });
    });

    return () => mm.revert();
  }, []);

  return (
    <div className="fizz-backdrop" ref={rootRef} aria-hidden="true">
      {LAYERS.map((layer) => (
        <div className="fizz-layer" data-speed={layer.speed} key={layer.speed}>
          {layer.pieces.map((piece) => (
            <div
              key={`${piece.kind}-${piece.x}-${piece.y}`}
              className={`fizz-piece fizz-piece--${piece.kind}`}
              data-float={piece.kind}
              data-desktop-only={piece.desktopOnly || undefined}
              style={
                {
                  left: `${piece.x}%`,
                  top: `${piece.y}%`,
                  '--size': `${piece.size}px`,
                  rotate: piece.rotate ? `${piece.rotate}deg` : undefined,
                } as CSSProperties
              }
            >
              <PieceArt piece={piece} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PieceArt({piece}: {piece: Piece}) {
  switch (piece.kind) {
    case 'bubble':
      return (
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="#fff" fillOpacity="0.5" stroke={piece.color} strokeWidth="7" strokeOpacity="0.75" />
          <path d="M28 38 A26 26 0 0 1 46 22" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
        </svg>
      );
    case 'wheel':
      return (
        <svg viewBox="-50 -50 100 100">
          <circle r="46" fill={piece.color} stroke="#fff" strokeWidth="6" />
          <circle r="33" fill={piece.flesh} />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <line key={a} y2="-33" stroke="#fff" strokeWidth="4" strokeLinecap="round" transform={`rotate(${a})`} />
          ))}
        </svg>
      );
    case 'ice':
      return (
        <svg viewBox="0 0 100 100">
          <rect x="8" y="8" width="84" height="84" rx="16" fill="#fff" fillOpacity="0.55" stroke="#fff" strokeWidth="5" />
          <path d="M26 56 V26 H56" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
        </svg>
      );
    case 'leaf':
      return (
        <svg viewBox="0 -35 100 70">
          <path d="M0 0 C25 -34 75 -34 100 0 C75 34 25 34 0 0 Z" fill={piece.color} />
          <path d="M6 0 H90" stroke="#bfe8a8" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );
  }
}
