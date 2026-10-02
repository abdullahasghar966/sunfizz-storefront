// Lighthouse (mobile, simulated throttling) 3 runs per page; prints the median of each category.
// Usage: node scripts/qa/lighthouse.mjs [baseUrl]   (serve a production build first: npm run preview)
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const BASE = process.argv[2] || 'http://localhost:3002';
const PAGES = {home: '/', listing: '/collections/all', product: '/products/citrus-sunrise'};
const RUNS = 3;
const OUT_DIR = process.env.OUT_DIR || fileURLToPath(new URL('./out/', import.meta.url));
fs.mkdirSync(OUT_DIR, {recursive: true});
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

for (const [name, route] of Object.entries(PAGES)) {
  const runs = [];
  for (let i = 1; i <= RUNS; i++) {
    const file = path.join(OUT_DIR, `lh-${name}-${i}.json`);
    let report = null;
    for (let attempt = 1; attempt <= 2 && !report; attempt++) {
      try {
        execFileSync(
          'npx',
          ['--yes', 'lighthouse@13', BASE + route, '--only-categories=performance,accessibility,best-practices,seo',
            '--output=json', `--output-path=${file}`, '--chrome-flags=--headless=new', '--quiet'],
          {stdio: 'ignore', shell: true},
        );
        report = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        console.warn(`${name} run ${i}: Lighthouse failed (attempt ${attempt})`);
      }
    }
    if (!report) continue;
    runs.push({
      scores: Object.fromEntries(Object.entries(report.categories).map(([k, v]) => [k, Math.round(v.score * 100)])),
      lcp: report.audits['largest-contentful-paint'].numericValue,
      tbt: report.audits['total-blocking-time'].numericValue,
      benchmark: report.environment?.benchmarkIndex ?? 0,
    });
  }
  if (!runs.length) continue;
  // Simulated throttling assumes a normal-speed machine; a laptop on battery can score far lower.
  const slow = median(runs.map((r) => r.benchmark));
  if (slow < 1500) console.warn(`${name}: CPU benchmark ${Math.round(slow)} (usually ~3500 here): machine throttled, scores not comparable`);
  const cat = (k) => median(runs.map((r) => r.scores[k]));
  console.log(
    `${name.padEnd(8)} perf ${cat('performance')} | a11y ${cat('accessibility')} | best ${cat('best-practices')} | seo ${cat('seo')}` +
      ` | LCP ${(median(runs.map((r) => r.lcp)) / 1000).toFixed(1)}s | TBT ${Math.round(median(runs.map((r) => r.tbt)))}ms` +
      `  (perf runs: ${runs.map((r) => r.scores.performance).join(', ')})`,
  );
}
