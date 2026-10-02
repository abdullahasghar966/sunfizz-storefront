# QA scripts

Checks used for the Phase 5/6 regression and performance reports. They drive the installed
Google Chrome through `puppeteer-core` (real GPU, real frame timing, and a separate browser
profile, so they never touch your own cart). They aren't part of the app or its build.

Setup, once, with the dev server stopped (Windows locks `workerd.exe` while it runs):

```bash
npm i --no-save puppeteer-core@25
```

Then start the site (`npm run dev` on :3000, or `npm run preview` for the production build) and run:

| Script | What it checks | Example |
|---|---|---|
| `regression.mjs` | Every page and flow: preloader, hero, parallax, cursor, magnetic, scramble, listing hover + entrance, card morph, 3D viewer, variants, add to cart, drawer (quantity, remove, empty state, focus trap), checkout handoff to Shopify, transitions on 12 routes + 404, phone and tablet widths, reduced motion, console errors | `node scripts/qa/regression.mjs http://localhost:3000` |
| `game-test.mjs` | The footer game: lazy load, Space scoping, start/jump/crash/restart, pauses (scroll, blur, Tab, Escape, hidden tab), reset on navigation, no loop while idle, per-frame cost | `node scripts/qa/game-test.mjs http://localhost:3000 desktop` (also `mobile`, `reduced`) |
| `perf-game.mjs` | Frame pacing, main-thread busy % and long tasks with the game idle vs running (arg 2: CPU slowdown) | `node scripts/qa/perf-game.mjs http://localhost:3002 4` |
| `lighthouse.mjs` | Lighthouse mobile, 3 runs per page, medians | `node scripts/qa/lighthouse.mjs http://localhost:3002` |

Screenshots and JSON results go to `scripts/qa/out/` (git-ignored). The checkout test stops at
Shopify's store-password page; nothing is typed there.
