import {CandyOff, Citrus, Sprout, type LucideIcon} from 'lucide-react';

const BENEFITS: {title: string; body: string; Icon: LucideIcon; tint: string}[] = [
  {
    title: 'Real fruit, real zing',
    body: 'Cold-pressed orange, grapefruit and lime. Nothing squeezed out of a lab.',
    Icon: Citrus,
    tint: 'var(--sf-tangerine)',
  },
  {
    title: 'Prebiotics for happy guts',
    body: '9g of plant fibre in every can to keep the good bacteria dancing.',
    Icon: Sprout,
    tint: 'var(--sf-lime)',
  },
  {
    title: 'Only 5g of sugar',
    body: 'All the sparkle of soda with a fraction of the sugar, and zero sweeteners.',
    Icon: CandyOff,
    tint: 'var(--sf-grapefruit)',
  },
];

/** Placeholder copy for the section under the hero (the parallax runs behind both). */
export function Benefits() {
  return (
    <section
      className="benefits"
      id="why-it-fizzes"
      aria-labelledby="benefits-title"
    >
      <p className="sf-eyebrow">Why it fizzes</p>
      <h2 className="benefits-title" id="benefits-title">
        Good vibes, better bubbles.
      </h2>
      <ul className="benefits-list">
        {BENEFITS.map(({title, body, Icon, tint}) => (
          <li className="benefit" key={title}>
            <span className="benefit-icon" style={{backgroundColor: tint}}>
              <Icon aria-hidden size={26} strokeWidth={2.25} />
            </span>
            <h3>{title}</h3>
            <p>{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
