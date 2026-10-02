// Package the Hydrogen production build for Vercel's Edge runtime and deploy it
// (free Hobby plan, public URL). The site itself is unchanged: Vercel runs the
// same web-standard worker module that Oxygen runs, behind a tiny wrapper.
// Once per machine: `npx vercel@latest login`. Values come from .env; none are printed.
// Usage: node scripts/deploy-vercel.mjs [--skip-build] [--package-only]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = path.join(ROOT, '.vercel', 'output');
const FUNC = path.join(OUT, 'functions', 'index.func');
const PROJECT = 'sunfizz';
const VARS = ['PUBLIC_STORE_DOMAIN', 'PUBLIC_STOREFRONT_API_TOKEN', 'PUBLIC_CHECKOUT_DOMAIN', 'SESSION_SECRET'];
const args = new Set(process.argv.slice(2));

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')];
    }),
);
const missing = VARS.filter((key) => !env[key]);
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}

// shell: true resolves npx/npm on Windows.
function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {stdio: 'inherit', shell: true, cwd: ROOT, ...options});
  if (result.status !== 0 && !options.allowFailure) process.exit(result.status ?? 1);
  return result;
}
const vercel = (commandArgs, options) => run('npx', ['--yes', 'vercel@latest', ...commandArgs], options);

// 1. Production build (the same one Oxygen deploys).
if (!args.has('--skip-build')) run('npm', ['run', 'build']);

// 2. Vercel Build Output API v3: static files + one Edge function for everything else.
fs.rmSync(OUT, {recursive: true, force: true});
fs.cpSync(path.join(ROOT, 'dist', 'client'), path.join(OUT, 'static'), {
  recursive: true,
  filter: (src) => !src.split(path.sep).includes('.vite'), // build manifest, not for visitors
});
fs.mkdirSync(FUNC, {recursive: true});
fs.copyFileSync(path.join(ROOT, 'dist', 'server', 'index.js'), path.join(FUNC, 'server.js'));
fs.writeFileSync(
  path.join(FUNC, 'index.js'),
  `// Vercel Edge entry: runs the Hydrogen worker build (the module Oxygen runs).
import worker from './server.js';

// Vercel's Edge runtime has no Cache API; Hydrogen then simply fetches without caching.
const noCache = {match: async () => undefined, put: async () => {}, delete: async () => false};
if (!('caches' in globalThis)) globalThis.caches = {open: async () => noCache};

export default function handler(request, event) {
  const env = {
${VARS.map((key) => `    ${key}: process.env.${key},`).join('\n')}
  };
  return worker.fetch(request, env, {
    waitUntil: (promise) => event?.waitUntil?.(promise),
    passThroughOnException() {},
  });
}
`,
);
fs.writeFileSync(
  path.join(FUNC, '.vc-config.json'),
  JSON.stringify({runtime: 'edge', entrypoint: 'index.js', envVarsInUse: VARS}, null, 2),
);
fs.writeFileSync(
  path.join(OUT, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Hashed build files never change: cache them for a year.
        {src: '^/assets/(.*)$', headers: {'cache-control': 'public, max-age=31536000, immutable'}, continue: true},
        {handle: 'filesystem'},
        {src: '/(.*)', dest: '/index'},
      ],
    },
    null,
    2,
  ),
);
process.stdout.write('Packaged .vercel/output\n');
if (args.has('--package-only')) process.exit(0);

// 3. Link the project once (creates "sunfizz" in your Vercel account).
if (!fs.existsSync(path.join(ROOT, '.vercel', 'project.json'))) {
  vercel(['link', '--yes', '--project', PROJECT]);
}

// 4. Production environment variables, piped in so values never appear in a command line.
const listed = vercel(['env', 'ls', 'production'], {stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8'}).stdout ?? '';
for (const key of VARS) {
  if (new RegExp(`\\b${key}\\b`).test(listed)) continue;
  // PUBLIC_* values are public by design (Hydrogen sends the storefront token to browsers): "config".
  // Anything else is a real secret.
  const type = key.startsWith('PUBLIC_') ? 'config' : 'secret';
  vercel(['env', 'add', key, 'production', '--type', type, '--yes'], {input: env[key], stdio: ['pipe', 'inherit', 'inherit']});
}

// 5. Deploy the packaged output to production.
vercel(['deploy', '--prebuilt', '--prod', '--yes']);
