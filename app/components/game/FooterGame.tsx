import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {useLocation} from 'react-router';
import {CupSoda} from 'lucide-react';
import {MOTION_OK} from '~/lib/motion';
import type {FizzDash, GameInfo, GameState} from './fizzDash';

const BEST_KEY = 'sf-fizz-dash-best';
/** Start fetching the game once the footer is this close to the viewport. */
const LOAD_MARGIN = '0px 0px 600px 0px';
/** Pause when less than this share of the stage is on screen. */
const VISIBLE_ENOUGH = 0.5;

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0; // storage blocked (private mode, policies): the best lasts this visit only
  }
}

function saveBest(best: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // storage blocked: keep the in-memory best
  }
}

function whenIdle(callback: () => void) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(callback, {timeout: 2000});
  else setTimeout(callback, 200); // Safari before 18
}

const OVERLAY: Record<Exclude<GameState, 'running'>, {title: string; verb: string}> = {
  idle: {title: 'Hop the ice, dodge the straws, catch the bubbles', verb: 'play'},
  paused: {title: 'Paused', verb: 'keep fizzing'},
  over: {title: 'Fizzled out!', verb: 'pour another'},
};

/**
 * Fizz Dash, the footer easter egg (engine: ./fizzDash). This wrapper is all
 * that ships with the page: the game code loads only when the footer comes
 * near, and it only runs after an explicit click, tap or key press on the
 * game itself.
 *
 * - Keys are handled on the game element, never on window: Space/Enter/Up are
 *   captured only while the game has focus, so everywhere else Space still
 *   scrolls the page and presses buttons. Tab always moves on (one tab stop,
 *   no trap), and leaving the game pauses it.
 * - Pauses when scrolled out of view, when the tab is hidden or when focus
 *   leaves; resets on navigation; destroy() on unmount leaves nothing running.
 * - Reduced motion: still playable on request, with minimal effects.
 */
export function FooterGame() {
  const titleId = useId();
  const hintId = useId();
  const helpId = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<FizzDash | null>(null);
  const loadingRef = useRef<Promise<FizzDash | null> | null>(null);
  const [state, setState] = useState<GameState>('idle');
  const [result, setResult] = useState<GameInfo>({score: 0, best: 0, newBest: false});
  const [announcement, setAnnouncement] = useState('');
  const {pathname} = useLocation();

  const load = useCallback(() => {
    loadingRef.current ??= import('./fizzDash')
      .then(({createFizzDash}) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const best = readBest();
        setResult((r) => ({...r, best}));
        const game = createFizzDash({
          canvas,
          best,
          reducedMotion: !window.matchMedia(MOTION_OK).matches,
          onStateChange: (next, info) => {
            setState(next);
            setResult(info);
            if (next === 'running') setAnnouncement('Fizz Dash started. Space or tap to jump.');
            else if (next === 'paused') setAnnouncement('Paused.');
            else if (next === 'over') {
              if (info.newBest) saveBest(info.best);
              setAnnouncement(
                `Fizzled out. Score ${info.score}${info.newBest ? ', a new best' : `, best ${info.best}`}.`,
              );
            }
          },
        });
        gameRef.current = game;
        return game;
      })
      .catch(() => null); // offline or no canvas: the footer keeps its still panel
    return loadingRef.current;
  }, []);

  // Fetch the game when the footer comes near (in idle time, so it never competes with the page).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        whenIdle(() => {
          void load();
        });
      },
      {rootMargin: LOAD_MARGIN},
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, [load]);

  // Pause when the stage scrolls away or the tab is hidden.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio < VISIBLE_ENOUGH) gameRef.current?.pause();
      },
      {threshold: [0, VISIBLE_ENOUGH]},
    );
    observer.observe(stage);
    const onVisibility = () => {
      if (document.hidden) gameRef.current?.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Follow the reduced-motion setting live.
  useEffect(() => {
    const query = window.matchMedia(MOTION_OK);
    const onChange = () => gameRef.current?.setReducedMotion(!query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Another page: stop and show the still poster again.
  useEffect(() => {
    gameRef.current?.reset();
  }, [pathname]);

  // Unmounted (e.g. the error shell replaced the layout): nothing may keep running.
  useEffect(
    () => () => {
      gameRef.current?.destroy();
      gameRef.current = null;
      document.documentElement.classList.remove('cursor-on-dark');
    },
    [],
  );

  // The site cursor reads data-cursor-label on pointerover; nudge it when the label changes under it.
  useEffect(() => {
    const stage = stageRef.current;
    if (stage?.matches(':hover')) {
      stage.dispatchEvent(new PointerEvent('pointerover', {bubbles: true}));
    }
  }, [state]);

  /** Start, resume or restart (the module loads first if it hasn't yet). */
  const activate = useCallback(async () => {
    const game = gameRef.current ?? (await load());
    if (!game) return;
    if (game.state === 'paused') game.resume();
    else if (game.state !== 'running') game.start();
  }, [load]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const game = gameRef.current;
    const running = game !== null && game.state === 'running';
    if (event.key === 'Escape') {
      if (running) {
        event.preventDefault();
        game.pause();
      }
      return;
    }
    const isSpace = event.key === ' ' || event.key === 'Spacebar';
    const isUp = event.key === 'ArrowUp' && running;
    if (!isSpace && !isUp && event.key !== 'Enter') return; // Tab and the rest behave as usual
    event.preventDefault(); // no page scroll while the game has focus
    if (running) {
      if (isSpace || isUp) game.jump();
    } else if (!event.repeat) {
      void activate(); // a held key after a crash doesn't restart by itself
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 0 && gameRef.current?.state === 'running') gameRef.current.jump();
  };

  // Clicks and taps start a game (a swipe that scrolls the page never becomes a click).
  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (gameRef.current?.state === 'running') {
      // A click synthesised by a keyboard or screen reader (detail 0) jumps; a mouse click already did on pointerdown.
      if (event.detail === 0) gameRef.current.jump();
      return;
    }
    void activate();
  };

  const overlay = state === 'running' ? null : OVERLAY[state];

  return (
    <section className="fizz-dash" aria-labelledby={titleId}>
      <div className="fizz-dash-head">
        <h2 className="fizz-dash-title" id={titleId}>
          <CupSoda aria-hidden size={18} strokeWidth={2.25} />
          Fizz Dash
        </h2>
        <p className="fizz-dash-hint" id={hintId}>
          <span className="fizz-dash-hint-keys">
            Press <kbd>Space</kbd> to jump
          </span>
          <span className="fizz-dash-hint-touch">Tap to jump</span>
        </p>
      </div>
      <div
        ref={stageRef}
        className="fizz-dash-stage"
        data-state={state}
        role="button"
        tabIndex={0}
        aria-label="Play Fizz Dash"
        aria-describedby={`${hintId} ${helpId}`}
        data-cursor-label={state === 'running' ? undefined : 'Play'}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onClick={onClick}
        onBlur={() => gameRef.current?.pause()}
        onPointerEnter={() => document.documentElement.classList.add('cursor-on-dark')}
        onPointerLeave={() => document.documentElement.classList.remove('cursor-on-dark')}
      >
        <canvas ref={canvasRef} className="fizz-dash-canvas" aria-hidden="true" />
        {overlay && (
          <span className="fizz-dash-overlay" aria-hidden="true">
            <strong>{overlay.title}</strong>
            {state === 'over' && (
              <span>
                You scored {result.score}
                {result.newBest ? ', a new best!' : ` · Best ${result.best}`}
              </span>
            )}
            {state === 'idle' && result.best > 0 && <span>Your best: {result.best}</span>}
            {/* Space only works once the game has focus, so say what applies (game.css picks one). */}
            <span className="fizz-dash-action">
              <span className="fizz-dash-when-focused">Press Space to {overlay.verb}</span>
              <span className="fizz-dash-when-blurred">Click to {overlay.verb}</span>
              <span className="fizz-dash-when-touch">Tap to {overlay.verb}</span>
            </span>
          </span>
        )}
      </div>
      <p className="sr-only" id={helpId}>
        A mini game: a can runs along, jumping over ice cubes, straws and lemon wheels and
        collecting bubbles. Space, Enter or a tap starts; Space, the up arrow or a tap jumps;
        Escape pauses. Tab moves on.
      </p>
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </section>
  );
}
