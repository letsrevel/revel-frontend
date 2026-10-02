import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Vitest only: rewrites named imports from heavy barrel packages into one deep
 * import per name, e.g.
 *
 *   import { Check, X as Close } from '@lucide/svelte';
 *   → import Check from '@lucide/svelte/icons/check'; import Close from '…/x';
 *
 *   import { Dialog as DialogPrimitive } from 'bits-ui';
 *   → import { Dialog as DialogPrimitive } from '<abs>/bits-ui/dist/bits/dialog/index.js';
 *
 * Vitest gives every test file its own module graph, so a component that
 * touches a barrel re-evaluates everything behind it once per test file —
 * ~1,900 icon components for lucide, every primitive for bits-ui. That was
 * the bulk of the suite's import time. Dev pre-bundles these barrels and the
 * production build tree-shakes them, so neither needs this.
 *
 * Names a map doesn't know (types, or a future non-component export) stay on
 * the barrel import, so the rewrite only ever narrows an import; it can't
 * break one. The rewritten imports stay on the original line, keeping
 * stack-trace line numbers intact.
 */

interface Barrel {
	/** Package specifier as written in source. */
	pkg: string;
	/** Exported name → replacement import statement for it. */
	load(): Map<string, (local: string) => string>;
}

const nodeModules = (...parts: string[]): string => resolve('node_modules', ...parts);

/**
 * Collects `export { default as Name } from './path'`. Anchored on the tail
 * only: the alias files wrap deprecated names in a JSDoc whose `{@link …}`
 * would end a `[^}]*` match early.
 */
function defaultReexports(file: string): [name: string, target: string][] {
	const re = /default as (\w+)\s*\}\s*from\s*['"]([^'"]+)['"]/g;
	return [...readFileSync(file, 'utf8').matchAll(re)].map(([, name, target]) => [name, target]);
}

const lucide: Barrel = {
	pkg: '@lucide/svelte',
	load() {
		const dist = nodeModules('@lucide/svelte', 'dist');
		const map = new Map<string, (local: string) => string>();
		for (const file of [
			'icons/index.js',
			'aliases/aliases.js',
			'aliases/prefixed.js',
			'aliases/suffixed.js'
		]) {
			for (const [name, target] of defaultReexports(join(dist, file))) {
				const icon = basename(target).replace(/(\.svelte)?\.js$|\.svelte$/, '');
				map.set(name, (local) => `import ${local} from '@lucide/svelte/icons/${icon}';`);
			}
		}
		return map;
	}
};

const bitsUi: Barrel = {
	pkg: 'bits-ui',
	load() {
		const bits = nodeModules('bits-ui', 'dist', 'bits');
		const source = readFileSync(join(bits, 'index.js'), 'utf8');
		const map = new Map<string, (local: string) => string>();
		for (const [, names, target] of source.matchAll(/export\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
			const path = join(bits, target);
			for (const name of names.split(',').map((n) => n.trim())) {
				if (!name || name.includes(' ')) continue;
				map.set(name, (local) =>
					local === name
						? `import { ${name} } from '${path}';`
						: `import { ${name} as ${local} } from '${path}';`
				);
			}
		}
		return map;
	}
};

export function splitBarrels(): Plugin {
	const barrels = [lucide, bitsUi].map((barrel) => {
		let map: Map<string, (local: string) => string> | undefined;
		const escaped = barrel.pkg.replace(/[/.-]/g, '\\$&');
		return {
			...barrel,
			re: new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escaped}['"];?`, 'g'),
			map(): Map<string, (local: string) => string> {
				if (!map) {
					map = barrel.load();
					// A barrel layout change would silently turn this plugin into a no-op.
					if (map.size < 10) throw new Error(`splitBarrels: couldn't parse ${barrel.pkg}`);
				}
				return map;
			}
		};
	});

	return {
		name: 'revel:split-barrels',
		enforce: 'pre',
		transform(code, id) {
			if (id.includes('/node_modules/') || !/\.(svelte|ts|js)$/.test(id)) return null;
			let out = code;
			for (const barrel of barrels) {
				if (!out.includes(barrel.pkg)) continue;
				out = out.replace(barrel.re, (_whole, specifiers: string) => {
					const map = barrel.map();
					const deep: string[] = [];
					const kept: string[] = [];
					const types: string[] = [];
					for (const raw of specifiers.split(',')) {
						const spec = raw.trim();
						if (!spec) continue;
						// Inline `type` specifiers move to an `import type`: left in a value
						// import they'd compile to `import {} from 'pkg'`, which still loads
						// the whole barrel for its side effects.
						if (spec.startsWith('type ')) {
							types.push(spec.slice(5).trim());
							continue;
						}
						const [imported, local = imported] = spec.split(/\s+as\s+/);
						const rewrite = map.get(imported);
						if (rewrite) deep.push(rewrite(local));
						else kept.push(spec);
					}
					if (kept.length) deep.push(`import { ${kept.join(', ')} } from '${barrel.pkg}';`);
					if (types.length) deep.push(`import type { ${types.join(', ')} } from '${barrel.pkg}';`);
					return deep.join(' ');
				});
			}
			return out === code ? null : { code: out, map: null };
		}
	};
}
