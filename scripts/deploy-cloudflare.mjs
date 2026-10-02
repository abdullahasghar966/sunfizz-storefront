// Build the storefront and deploy it to Cloudflare Workers (free plan, public URL).
// Once per machine: `npx wrangler@4 login`. Values come from .env; none are printed.
// Usage: node scripts/deploy-cloudflare.mjs [--skip-build]
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';

const PUBLIC_VARS = ['PUBLIC_STORE_DOMAIN', 'PUBLIC_STOREFRONT_API_TOKEN', 'PUBLIC_CHECKOUT_DOMAIN'];
const SECRETS = ['SESSION_SECRET'];

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2')];
    }),
);
const missing = [...PUBLIC_VARS, ...SECRETS].filter((key) => !env[key]);
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}

// shell: true resolves npx/npm on Windows; values are quoted (none contain quotes).
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {stdio: 'inherit', shell: true, ...options});
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!process.argv.includes('--skip-build')) run('npm', ['run', 'build']);

// Public values as plain variables (the storefront token is public by design).
run('npx', ['--yes', 'wrangler@4', 'deploy', ...PUBLIC_VARS.map((key) => `--var "${key}:${env[key]}"`)]);

// The session secret as an encrypted secret, piped in so it never appears in a command line.
for (const key of SECRETS) {
  run('npx', ['--yes', 'wrangler@4', 'secret', 'put', key], {
    input: env[key],
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}
