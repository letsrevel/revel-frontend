#!/usr/bin/env node
/**
 * Untranslated-copy guard.
 *
 * `validate-translations.js` proves every key EXISTS in every locale. It cannot tell
 * you whether the value was ever translated — a locale that ships the English string
 * verbatim still counts as a present, non-empty key, which is why the completion
 * figure read "100%" while 661 German and 589 Italian strings were literally English.
 *
 * This check closes that hole: a target-locale value byte-identical to the English
 * source is treated as UNTRANSLATED and fails, unless the pair is recorded in
 * `scripts/i18n-identical-allowlist.json`. Some strings genuinely must stay identical
 * — brand names (Revel, Stripe, Telegram), format-only strings ({start} – {end}, ~{amount}),
 * and loanwords a language really uses (fr "Contact", it "Password"). Those are listed
 * explicitly, per locale, so "needs no translation" is a recorded decision rather than
 * an accident that looks exactly like a forgotten string.
 *
 * There is deliberately no `--update` flag: regenerating the allowlist wholesale would
 * rubber-stamp precisely the mistake this guard exists to catch. Add entries by hand.
 *
 * Usage: node scripts/check-i18n-untranslated.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWLIST = resolve(ROOT, 'scripts/i18n-identical-allowlist.json');
const SOURCE = 'en';
const TARGETS = ['de', 'fr', 'it', 'es', 'pt'];

const load = (locale) =>
	JSON.parse(readFileSync(resolve(ROOT, `messages/${locale}.json`), 'utf-8'));

/** Flatten to [pathArray, value]. Paths are arrays: the catalogs mix nested and literal
 *  dotted keys, so a dotted string is NOT a unique address (42 paths collide). */
function* leaves(node, path = []) {
	if (Array.isArray(node)) {
		for (const [i, v] of node.entries()) yield* leaves(v, [...path, i]);
	} else if (node && typeof node === 'object') {
		for (const [k, v] of Object.entries(node)) yield* leaves(v, [...path, k]);
	} else if (typeof node === 'string') {
		yield [path, node];
	}
}

/** Paraglide complex-message plumbing and the schema pointer are machine values,
 *  identical across every locale by design. */
function isStructural(path) {
	if (path.length === 1 && path[0] === '$schema') return true;
	if (path.includes('declarations') || path.includes('selectors')) return true;
	return path.length >= 2 && path[path.length - 2] === 'match';
}

const allowlist = JSON.parse(readFileSync(ALLOWLIST, 'utf-8'));
const en = new Map();
for (const [path, value] of leaves(load(SOURCE))) en.set(JSON.stringify(path), value);

let failed = 0;
let staleTotal = 0;
const report = [];

for (const locale of TARGETS) {
	const allowed = new Set(allowlist[locale] ?? []);
	const seen = new Set();
	const offenders = [];

	for (const [path, value] of leaves(load(locale))) {
		if (isStructural(path)) continue;
		if (en.get(JSON.stringify(path)) !== value) continue;
		if (allowed.has(value)) {
			seen.add(value);
			continue;
		}
		offenders.push({ key: path.join('.'), value });
	}

	const stale = [...allowed].filter((v) => !seen.has(v));
	staleTotal += stale.length;
	if (offenders.length) {
		failed += offenders.length;
		report.push({ locale, offenders, stale });
	}
}

if (failed === 0) {
	const total = TARGETS.reduce((n, l) => n + (allowlist[l]?.length ?? 0), 0);
	console.log(
		`✓ No untranslated strings (${total} allowlisted identical value(s) across ${TARGETS.length} locales).`
	);
	if (staleTotal > 0) {
		console.log(
			`   (${staleTotal} allowlist entr${staleTotal === 1 ? 'y is' : 'ies are'} now stale — the string was translated or removed; prune them.)`
		);
	}
	process.exit(0);
}

console.error(`\n❌ ${failed} untranslated string(s) — value is identical to English:\n`);
for (const { locale, offenders } of report) {
	console.error(`  ${locale} (${offenders.length}):`);
	for (const { key, value } of offenders.slice(0, 15)) {
		console.error(`    ${key} = ${JSON.stringify(value)}`);
	}
	if (offenders.length > 15) console.error(`    … and ${offenders.length - 15} more`);
}
console.error(`
Fix each one by EITHER:
  • translating it in messages/<locale>.json, OR
  • adding the English value to that locale's list in
    scripts/i18n-identical-allowlist.json — but only when the language genuinely
    uses the English word (brand name, loanword, format-only string).
`);
process.exit(1);
