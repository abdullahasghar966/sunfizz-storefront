/**
 * Static markup for "the pour": one full-screen liquid panel (lemon → tangerine
 * soda with wavy edges and rising bubbles) used by the preloader, every page
 * transition and the checkout handoff (lib/pour.ts drives it). Rendered by the
 * root Layout so it's in the server HTML and can cover the very first paint.
 * Decorative only: the page underneath stays in the accessibility tree.
 */
const BUBBLES = [
  {x: 8, size: 10, dur: 2.4, delay: 0},
  {x: 17, size: 6, dur: 1.9, delay: 0.6},
  {x: 29, size: 14, dur: 2.8, delay: 0.3},
  {x: 41, size: 7, dur: 2.1, delay: 1.1},
  {x: 55, size: 11, dur: 2.6, delay: 0.2},
  {x: 63, size: 5, dur: 1.7, delay: 0.9},
  {x: 74, size: 12, dur: 2.9, delay: 0.5},
  {x: 86, size: 8, dur: 2.2, delay: 1.3},
  {x: 93, size: 6, dur: 1.8, delay: 0.1},
];

export function PourOverlay() {
  return (
    <div className="pour" aria-hidden="true">
      {/* Cream screen behind the liquid, only while the first load is preloading. */}
      <div className="pour-backdrop" />
      <div className="pour-liquid">
        <div className="pour-wave pour-wave--top" />
        <div className="pour-bubbles">
          {BUBBLES.map((b) => (
            <span
              key={b.x}
              style={{
                left: `${b.x}%`,
                width: b.size,
                height: b.size,
                animationDuration: `${b.dur}s`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
        </div>
        <div className="pour-wave pour-wave--bottom" />
      </div>
      <div className="pour-center">
        <p className="pour-word">
          SUN<span>FIZZ</span>
        </p>
        <p className="pour-label">Pouring&hellip;</p>
        <p className="pour-sub" />
      </div>
    </div>
  );
}
