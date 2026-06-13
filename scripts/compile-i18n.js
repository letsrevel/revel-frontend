/**
 * Compiles Paraglide i18n messages.
 *
 * This replaces the `paraglide-js compile` CLI invocation because the CLI does
 * not expose `outputStructure`. We need `locale-modules` (one module per locale)
 * instead of the default `message-modules` (one module per message): with ~1,800
 * message keys × 3 locales the default emits ~5,400 modules, which roughly
 * doubles `vite build` time and slows dev-server cold loads.
 *
 * Output stays in `src/lib/paraglide` with the same public entry points
 * (`messages.js`, `runtime.js`), so no imports change.
 */
import { resolve } from 'node:path';
import { compile } from '@inlang/paraglide-js';

await compile({
	project: resolve(process.cwd(), './project.inlang'),
	outdir: './src/lib/paraglide',
	outputStructure: 'locale-modules'
});

console.log('✓ Paraglide messages compiled (locale-modules)');
