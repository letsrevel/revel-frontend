#!/usr/bin/env node
// Paraglide compiled-bundle freshness gate (#789).
//
// A stale compiled bundle happens when `messages/*.json` gains (or loses) keys
// but nobody re-ran `pnpm paraglide:compile` and committed the result. Any page
// that references a key missing from the compiled bundle hard-500s at runtime —
// this produced 22 false e2e failures in one checkpoint run and is invisible
// until the page actually renders.
//
// Detection strategy: recompile the catalogs into a scratch directory with the
// exact same compiler `pnpm paraglide:compile` uses, then diff the exported
// message identifiers against what's checked into `src/lib/paraglide/messages/`.
// This deliberately does NOT try to reimplement Paraglide's key -> identifier
// scheme (lowercased, underscore-joined, numeric disambiguation suffix per
// message — e.g. `eventSchedule.title` -> `eventschedule_title1`, catalogs use
// BOTH flat and nested dotted keys and the suffix is an internal compiler detail
// that can change across versions). Recompiling and diffing is the only
// reliable way to know whether the compiler's output changed, and it's cheap
// (~1s for ~2,400 keys x 6 locales).
//
// Wired into `make check` (i18n-freshness target) and as the first step of
// `pnpm build`, so a stale bundle fails loudly and immediately instead of
// surfacing as a runtime 500 or a silent gap in e2e coverage.
//
// Usage: node scripts/check-paraglide-freshness.mjs

import { compile } from '@inlang/paraglide-js';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const COMMITTED_MESSAGES_DIR = join(ROOT, 'src/lib/paraglide/messages');
const EXPORT_RE = /^export const (\w+)/gm;

/** @param {string} source */
function extractExportNames(source) {
	return new Set([...source.matchAll(EXPORT_RE)].map((m) => m[1]));
}

/** @param {string} dir */
async function loadLocaleExports(dir) {
	const files = (await readdir(dir)).filter((f) => f.endsWith('.js') && f !== '_index.js');
	/** @type {Map<string, Set<string>>} */
	const result = new Map();
	for (const file of files) {
		const source = await readFile(join(dir, file), 'utf-8');
		result.set(file, extractExportNames(source));
	}
	return result;
}

async function main() {
	const scratchDir = await mkdtemp(join(tmpdir(), 'paraglide-freshness-'));

	try {
		await compile({
			project: join(ROOT, 'project.inlang'),
			outdir: scratchDir,
			outputStructure: 'locale-modules'
		});

		const fresh = await loadLocaleExports(join(scratchDir, 'messages'));
		const committed = await loadLocaleExports(COMMITTED_MESSAGES_DIR);

		/** @type {{ file: string; missing: string[]; extra: string[] }[]} */
		const problems = [];

		const allFiles = new Set([...fresh.keys(), ...committed.keys()]);
		for (const file of allFiles) {
			const freshKeys = fresh.get(file) ?? new Set();
			const committedKeys = committed.get(file) ?? new Set();
			const missing = [...freshKeys].filter((k) => !committedKeys.has(k)).sort();
			const extra = [...committedKeys].filter((k) => !freshKeys.has(k)).sort();
			if (missing.length > 0 || extra.length > 0) {
				problems.push({ file, missing, extra });
			}
		}

		if (problems.length > 0) {
			console.error(
				'\n✗ Paraglide compiled bundle is stale (messages/*.json != compiled output).\n'
			);
			for (const { file, missing, extra } of problems) {
				if (missing.length > 0) {
					console.error(`  ${file}: ${missing.length} message(s) missing from the compiled bundle`);
					for (const key of missing.slice(0, 5)) console.error(`    - ${key}`);
					if (missing.length > 5) console.error(`    ... and ${missing.length - 5} more`);
				}
				if (extra.length > 0) {
					console.error(`  ${file}: ${extra.length} compiled message(s) no longer in the catalog`);
					for (const key of extra.slice(0, 5)) console.error(`    - ${key}`);
					if (extra.length > 5) console.error(`    ... and ${extra.length - 5} more`);
				}
			}
			console.error('\nRun `pnpm paraglide:compile` and commit the result.\n');
			process.exitCode = 1;
			return;
		}

		console.log(
			`✓ Paraglide compiled bundle is up to date (${committed.size} locale files checked)`
		);
	} finally {
		await rm(scratchDir, { recursive: true, force: true });
	}
}

main().catch((err) => {
	console.error('✗ Paraglide freshness check failed to run:', err);
	console.error('\nRun `pnpm paraglide:compile` and commit the result.\n');
	process.exitCode = 1;
});
