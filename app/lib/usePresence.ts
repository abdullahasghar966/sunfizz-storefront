import {useCallback, useEffect, useRef, useState} from 'react';

export type Presence<T> = {key: string; item: T; exiting: boolean};

/**
 * Keeps items that just left `items` rendered (flagged `exiting`, at their
 * old position) until `done(key)` is called, so they can animate out instead
 * of vanishing. Works with optimistic UIs that drop an item the instant it's
 * removed: the request goes out immediately, the exit plays on a snapshot.
 *
 * `items` may be a brand-new array on every render (Hydrogen's optimistic
 * cart clones the cart each render); only keys are compared. An exiting item
 * that comes back (the removal failed) is simply live again.
 */
export function usePresence<T>(items: T[], getKey: (item: T) => string) {
  const [leaving, setLeaving] = useState<Presence<T>[]>([]);
  const lastRendered = useRef<Presence<T>[]>([]);

  const current = items.map((item) => ({key: getKey(item), item, exiting: false}));
  const live = new Set(current.map((entry) => entry.key));

  // Items that were on screen last commit and are gone now start leaving.
  // (Setting state during render is React's "adjust state on prop change"
  // pattern; the condition is false on the immediate re-render, so it settles.)
  const known = new Set(leaving.map((entry) => entry.key));
  // Only items that were *live* last time count: a leaver that finished (done)
  // is still in lastRendered as `exiting` for one commit and must not restart.
  const newlyGone = lastRendered.current.filter(
    (entry) => !entry.exiting && !live.has(entry.key) && !known.has(entry.key),
  );
  if (newlyGone.length) {
    setLeaving((old) => [...old, ...newlyGone.map((entry) => ({...entry, exiting: true}))]);
  }

  const exiting = [...leaving, ...newlyGone.map((e) => ({...e, exiting: true}))].filter(
    (entry) => !live.has(entry.key),
  );
  const rendered = merge(lastRendered.current, current, exiting);

  useEffect(() => {
    lastRendered.current = rendered;
  });

  // Forget leavers that came back to life.
  const liveKeys = current.map((entry) => entry.key).join('|');
  useEffect(() => {
    const back = new Set(liveKeys.split('|'));
    if (leaving.some((entry) => back.has(entry.key))) {
      setLeaving((old) => old.filter((entry) => !back.has(entry.key)));
    }
  }, [leaving, liveKeys]);

  const done = useCallback((key: string) => {
    setLeaving((old) => old.filter((entry) => entry.key !== key));
  }, []);

  return [rendered, done] as const;
}

/** Live items in their new order, each leaver re-inserted after its nearest earlier neighbour. */
function merge<T>(
  previous: Presence<T>[],
  current: Presence<T>[],
  exiting: Presence<T>[],
): Presence<T>[] {
  const next = [...current];
  exiting.forEach((leaver) => {
    const index = previous.findIndex((entry) => entry.key === leaver.key);
    let at = 0;
    for (let j = index - 1; j >= 0; j--) {
      const pos = next.findIndex((entry) => entry.key === previous[j].key);
      if (pos !== -1) {
        at = pos + 1;
        break;
      }
    }
    next.splice(index === -1 ? next.length : at, 0, leaver);
  });
  return next;
}
