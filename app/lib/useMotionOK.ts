import {useEffect, useState} from 'react';
import {MOTION_OK} from '~/lib/motion';

/**
 * React state for "(prefers-reduced-motion: no-preference)". False on the
 * server and during hydration (render the still version first), then follows
 * the OS setting live.
 */
export function useMotionOK() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(MOTION_OK);
    const update = () => setOk(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return ok;
}

/** Resolve once the display font is in, or after `timeoutMs`, whichever is first. */
export function displayFontReady(timeoutMs = 1500) {
  const loaded = document.fonts
    .load('650 1em "Fredoka Variable"')
    .catch(() => undefined)
    .then(() => document.fonts.ready);
  return Promise.race([
    loaded,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
