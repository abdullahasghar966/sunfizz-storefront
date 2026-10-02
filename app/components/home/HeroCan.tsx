/**
 * Placeholder product art: an illustrated can for the fictional "Sunfizz"
 * brand. Swapped for a real 3D render in Phase 3.
 */
export function HeroCan() {
  return (
    // aria-label rather than an SVG <title>: a <title> also pops a hover tooltip.
    <svg
      className="hero-can-art"
      viewBox="0 0 260 470"
      role="img"
      aria-label="A can of Sunfizz sparkling citrus tonic"
    >
      <defs>
        <linearGradient id="sf-can-body" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#d4460a" />
          <stop offset="0.22" stopColor="#ff7a1a" />
          <stop offset="0.5" stopColor="#ff9d48" />
          <stop offset="0.8" stopColor="#ff7a1a" />
          <stop offset="1" stopColor="#c43f09" />
        </linearGradient>
        <linearGradient id="sf-can-rim" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#b9ae9f" />
          <stop offset="0.45" stopColor="#f7f2eb" />
          <stop offset="1" stopColor="#ada190" />
        </linearGradient>
        <linearGradient id="sf-can-label" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#f1e2c8" />
          <stop offset="0.5" stopColor="#fffaf1" />
          <stop offset="1" stopColor="#ecdbbf" />
        </linearGradient>
      </defs>

      <rect x="52" y="16" width="156" height="30" rx="13" fill="url(#sf-can-rim)" />
      <rect x="40" y="32" width="180" height="400" rx="40" fill="url(#sf-can-body)" />
      <rect x="54" y="418" width="152" height="28" rx="13" fill="url(#sf-can-rim)" />

      {/* Wavy label band */}
      <path
        d="M40 160 C70 144 100 176 130 160 S190 176 220 160 L220 326 C190 342 160 310 130 326 S70 310 40 326 Z"
        fill="url(#sf-can-label)"
      />

      {/* Citrus-slice emblem */}
      <g transform="translate(130 196)">
        <circle r="24" fill="#ffd23f" stroke="#fff" strokeWidth="4" />
        <circle r="17" fill="#ffe27a" />
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <line
            key={angle}
            y2="-17"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(${angle})`}
          />
        ))}
      </g>
      <text x="130" y="264" textAnchor="middle" className="hero-can-word">
        SUN
      </text>
      <text
        x="130"
        y="308"
        textAnchor="middle"
        className="hero-can-word hero-can-word--accent"
      >
        FIZZ
      </text>

      {/* Cylinder highlights and a few printed bubbles */}
      <rect x="60" y="54" width="14" height="358" rx="7" fill="#fff" opacity="0.28" />
      <rect x="82" y="54" width="5" height="358" rx="2.5" fill="#fff" opacity="0.18" />
      <circle cx="186" cy="92" r="8" fill="#fff" opacity="0.3" />
      <circle cx="170" cy="120" r="4.5" fill="#fff" opacity="0.3" />
      <circle cx="190" cy="372" r="6" fill="#fff" opacity="0.25" />
    </svg>
  );
}
