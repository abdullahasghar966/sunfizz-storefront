import {useEffect, useRef} from 'react';
import {gsap} from '~/lib/motion';

/**
 * A thin lemon → tangerine "fill line" at the top of the viewport showing how
 * far down the page you are, with a little bubble riding its tip. Driven by
 * scroll position (works the same with Lenis or native scroll, and under
 * reduced motion, since it is state rather than decoration). Hidden on pages
 * too short to scroll.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const fill = bar.querySelector<HTMLElement>('.scroll-progress-fill');
    const tip = bar.querySelector<HTMLElement>('.scroll-progress-tip');
    if (!fill || !tip) return;
    const setScale = gsap.quickSetter(fill, 'scaleX');
    const setTipX = gsap.quickSetter(tip, 'x', 'px');
    let queued = false;

    const measure = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const scrollable = max > 80;
      bar.classList.toggle('is-scrollable', scrollable);
      const progress = scrollable ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      setScale(progress);
      setTipX(progress * bar.clientWidth);
    };
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', queue, {passive: true});
    window.addEventListener('resize', queue);
    // Page height changes when routes swap or content loads in.
    const observer = new ResizeObserver(queue);
    observer.observe(document.body);
    return () => {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="scroll-progress" ref={ref} aria-hidden="true">
      <span className="scroll-progress-fill" />
      <span className="scroll-progress-tip" />
    </div>
  );
}
