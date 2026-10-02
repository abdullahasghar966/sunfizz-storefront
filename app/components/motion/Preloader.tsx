import {useEffect} from 'react';
import {pourFill, pourReveal} from '~/lib/pour';
import {openStage} from '~/lib/stage';

/** The preloader never holds the page longer than this (ms since navigation start). */
const MAX_MS = 2200;
/** …and never flashes by quicker than this, so the fill reads as intentional. */
const MIN_MS = 900;
const SESSION_KEY = 'sf-poured';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

/**
 * First visit of a browser session only (an inline <head> script adds
 * html.is-preloading before first paint; reduced motion never gets it).
 * The server-rendered pour overlay already covers the page with a cream
 * screen and a CSS pre-fill; once React hydrates, the liquid level follows
 * the only things that matter for the hero (hydration, then the display
 * font), tops up, and rises away: the same reveal as every page transition,
 * with the hero entrance starting as it lifts. Never waits on images or 3D.
 */
export function Preloader() {
  useEffect(() => {
    const html = document.documentElement;
    if (!html.classList.contains('is-preloading')) return;
    let finished = false;

    // Hydrated: the biggest step is done.
    void pourFill(0.62, 0.5);

    const font = document.fonts
      .load('650 1em "Fredoka Variable"')
      .catch(() => undefined)
      .then(() => {
        if (!finished) void pourFill(0.86, 0.4);
      });

    const ready = Promise.all([font, wait(MIN_MS - performance.now())]);
    const deadline = wait(MAX_MS - performance.now());

    void Promise.race([ready, deadline]).then(async () => {
      if (finished) return;
      finished = true;
      await pourFill(1, 0.3);
      html.classList.remove('is-preloading'); // drops the cream backdrop: the page is under the liquid now
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        // storage blocked: the preloader simply plays again next load
      }
      openStage(); // hero entrance starts as the liquid lifts
      await pourReveal();
    });

    return () => {
      finished = true;
    };
  }, []);

  return null;
}

/**
 * Inline <head> script (runs before first paint): flags JS, and marks the first
 * load of a session for the preloader unless reduced motion is on.
 */
export const PRELOAD_FLAG_SCRIPT = `(function(){var d=document.documentElement;d.classList.add('js');try{if(!sessionStorage.getItem('${SESSION_KEY}')&&window.matchMedia('(prefers-reduced-motion: no-preference)').matches){d.classList.add('is-preloading')}}catch(e){}})()`;
