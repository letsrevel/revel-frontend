/**
 * Compiles Paraglide i18n messages.
 *
 * This replaces the `paraglide-js compile` CLI invocation because the CLI does
 * not expose `outputStructure`. It emits two different shapes:
 *
 * - default → `src/lib/paraglide`, `locale-modules` (one module per locale).
 *   Used by the dev server, Vitest and svelte-check. Dev does not tree-shake,
 *   so `message-modules` there means the browser fetches every message module
 *   (~8,700) as its own request and the page never hydrates.
 *
 * - `--build` → `.paraglide-build`, `message-modules` (one module per message,
 *   all locales inside). Used by `pnpm build` only; the `paraglideBuildOutput`
 *   plugin in vite.config.ts redirects `$lib/paraglide/*` there. Rollup then
 *   tree-shakes each route down to the messages it references. With
 *   `locale-modules` every page shipped one ~1 MB-gzipped chunk holding every
 *   message in every locale, and hydration waited for it: on cold-cache mobile
 *   loads the header stayed SSR-only (burger menu / language picker dead on
 *   tap) for ~10s.
 *
 *   Dynamic lookups (`m[someVar]()`) defeat that tree-shaking: the chunk they
 *   land in pulls in every message. Prefer static `m['key']()` calls.
 *
 * The build output lives in its own directory so a production build (e.g. the
 * E2E `pnpm build && pnpm preview`) never rewrites the files a running dev
 * server is serving.
 */
import { resolve } from 'node:path';
import { compile } from '@inlang/paraglide-js';

const forBuild = process.argv.includes('--build');
const outputStructure = forBuild ? 'message-modules' : 'locale-modules';

await compile({
	project: resolve(process.cwd(), './project.inlang'),
	outdir: forBuild ? './.paraglide-build' : './src/lib/paraglide',
	outputStructure
});

console.log(`✓ Paraglide messages compiled (${outputStructure})`);
