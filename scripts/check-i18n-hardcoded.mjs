#!/usr/bin/env node
/**
 * i18n hardcoded-string guard (the FE analogue of the backend's
 * `scripts/check_translations.py` "keys extracted" check).
 *
 * The backend extracts every `_()`-wrapped string with gettext and fails if a
 * code string is missing from the catalog. Paraglide has no extraction step —
 * developers must wrap user-facing copy in `m['...']()` by hand — so this guard
 * does the inverse: it scans the source for user-facing string LITERALS that were
 * NOT wrapped, and fails when a new one is introduced.
 *
 * What it flags (the three ways untranslated copy reaches users):
 *   1. `toast.success|error|info|warning|loading|message('literal')`
 *   2. user-facing attributes: aria-label / placeholder / title / alt = "literal"
 *   3. visible text nodes:  >Some Text<
 *
 * Excluded (never scanned):
 *   - SEO landing pages: src/routes/(public)/{de,it,fr}/**, src/lib/data/landing-pages.ts
 *   - generated / paraglide / data / *.test.* / *.spec.* / *.d.ts / *.example.*
 *   - <style> blocks, <svelte:head> blocks, HTML/JS comments
 *
 * Baseline ratchet:
 *   The codebase has legitimately non-translatable literals (brand names, currency
 *   data, enum tokens, format hints). Those are recorded in the committed baseline
 *   `scripts/i18n-hardcoded-baseline.json` (keyed by file → accepted strings). The
 *   check fails only on findings NOT in the baseline — i.e. NEW hardcoded strings.
 *   It never auto-passes a removed entry; stale baseline entries are reported (not
 *   a failure) so the list shrinks as strings get translated.
 *
 * Escape hatch:
 *   Put `i18n-ignore` in a comment on the same line (or the line directly above)
 *   to suppress a single genuinely-non-translatable literal without touching the
 *   baseline.
 *
 * Usage:
 *   node scripts/check-i18n-hardcoded.mjs           # check (CI / make check)
 *   node scripts/check-i18n-hardcoded.mjs --update   # regenerate the baseline
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = resolve(ROOT, 'scripts/i18n-hardcoded-baseline.json');
const UPDATE = process.argv.includes('--update');

const EXCLUDE = [
	/\/paraglide\//,
	/\/api\/generated\//,
	/\/lib\/data\/landing-pages\.ts$/,
	/\/routes\/\(public\)\/(de|it|fr)\//, // localized SEO landing pages
	/\.test\./,
	/\.spec\./,
	/\.d\.ts$/,
	/\.example\./
];

// Proper nouns / acronyms / tokens that are never translated.
const ALLOW_WORDS = new Set(
	[
		'Revel',
		'Stripe',
		'Telegram',
		'Eventbrite',
		'PayPal',
		'Apple',
		'Apple Wallet',
		'Google',
		'Google Wallet',
		'Instagram',
		'Facebook',
		'Bluesky',
		'Twitter',
		'X',
		'iOS',
		'Android',
		'QR',
		'PDF',
		'CSV',
		'URL',
		'ID',
		'OK',
		'N/A',
		'GmbH',
		'Promise',
		'EUR',
		'USD',
		'GBP',
		'VAT',
		'IBAN'
	].map((s) => s.toLowerCase())
);

const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];

/** Mask a region of `s` (same length, newlines preserved) so offsets stay valid. */
function blank(match) {
	return match.replace(/[^\n]/g, ' ');
}

function strip(content, file) {
	let c = content;
	c = c.replace(/<style[\s\S]*?<\/style>/g, blank);
	c = c.replace(/<svelte:head[\s\S]*?<\/svelte:head>/g, blank); // SEO meta/JSON-LD
	c = c.replace(/<!--[\s\S]*?-->/g, blank); // HTML comments
	// JS comments (incl. JSDoc `@example` blocks) — strip in .ts and inside Svelte <script>.
	c = c.replace(/\/\*[\s\S]*?\*\//g, blank); // block comments (safe: markup has none)
	if (file.endsWith('.ts')) {
		c = c.replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length))); // line comments
	} else {
		// Svelte: strip `//` line comments only within <script> regions (avoids
		// matching `//` inside URLs/text in markup).
		c = c.replace(/<script[\s\S]*?<\/script>/g, (block) =>
			block.replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)))
		);
	}
	return c;
}

function lineAt(content, idx) {
	return content.slice(0, idx).split('\n').length;
}
function lineText(content, line) {
	return content.split('\n')[line - 1] ?? '';
}
function hasIgnore(content, line) {
	return (
		/i18n-ignore/.test(lineText(content, line)) || /i18n-ignore/.test(lineText(content, line - 1))
	);
}

/** True when a string is NOT user-facing prose and should be ignored outright. */
function isNonProse(raw) {
	const s = raw.trim();
	if (!s) return true;
	if (!/[A-Za-z]/.test(s)) return true; // no letters (numbers/punct/glyphs)
	if (ALLOW_WORDS.has(s.toLowerCase())) return true; // brand/acronym
	if (/^https?:\/\//.test(s) || /^@/.test(s) || /example\.(com|org)/.test(s)) return true; // url/handle/example
	if (/^[\w.-]+@[\w.-]+$/.test(s)) return true; // email
	if (/^[a-z][a-zA-Z0-9_]*$/.test(s)) return true; // single camel/snake identifier
	// strip interpolation tokens; if nothing prose-like remains, ignore
	const noTokens = s.replace(/\{[^}]*\}/g, '').trim();
	if (!/[A-Za-z]{2,}/.test(noTokens)) return true;
	if (s === s.toUpperCase() && s.replace(/[^A-Za-z]/g, '').length <= 4) return true; // short ACRONYM
	return false;
}

/** Stricter gate for bare text nodes (noisiest source). */
function isProseTextNode(raw) {
	const s = raw.trim();
	if (isNonProse(s)) return false;
	const words = s
		.replace(/\{[^}]*\}/g, ' ')
		.trim()
		.split(/\s+/)
		.filter((w) => /[A-Za-z]{2,}/.test(w));
	if (words.length === 0) return false;
	// single short word with no sentence punctuation → likely a label/enum token, skip
	if (words.length === 1 && s.length < 3) return false;
	return true;
}

const ATTR_RE = new RegExp(`\\b(${ATTRS.join('|')})="([^"{}]*[A-Za-z]{2,}[^"{}]*)"`, 'g');
const TOAST_RE =
	/\btoast\.(success|error|info|warning|message|loading)\(\s*(['"`])([^'"`\n]*[A-Za-z]{2,}[^'"`\n]*)\2/g;
const TEXT_RE = />\s*([A-Z][^<>{}]*[a-z][^<>{}]*?)\s*</g;

function scanFile(file) {
	let content;
	try {
		content = readFileSync(resolve(ROOT, file), 'utf-8');
	} catch {
		return [];
	}
	const c = strip(content, file);
	const found = new Set();
	const push = (str, idx) => {
		const line = lineAt(c, idx);
		if (hasIgnore(content, line)) return;
		found.add(str.trim());
	};

	let m;
	ATTR_RE.lastIndex = 0;
	while ((m = ATTR_RE.exec(c))) if (!isNonProse(m[2])) push(`${m[1]}="${m[2].trim()}"`, m.index);
	TOAST_RE.lastIndex = 0;
	while ((m = TOAST_RE.exec(c))) if (!isNonProse(m[3])) push(`toast: ${m[3].trim()}`, m.index);
	if (file.endsWith('.svelte')) {
		TEXT_RE.lastIndex = 0;
		while ((m = TEXT_RE.exec(c))) if (isProseTextNode(m[1])) push(`text: ${m[1].trim()}`, m.index);
	}
	return [...found].sort();
}

// ── gather source files ──────────────────────────────────────────────────────
const files = execSync('git ls-files src', { cwd: ROOT, encoding: 'utf-8' })
	.split('\n')
	.filter(Boolean)
	.filter((f) => (f.endsWith('.svelte') || f.endsWith('.ts')) && !EXCLUDE.some((re) => re.test(f)));

const current = {};
for (const f of files) {
	const hits = scanFile(f);
	if (hits.length) current[f] = hits;
}

// ── update mode ──────────────────────────────────────────────────────────────
if (UPDATE) {
	writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
	const total = Object.values(current).reduce((a, h) => a + h.length, 0);
	console.log(
		`✅ Wrote baseline: ${total} accepted literal(s) across ${Object.keys(current).length} file(s).`
	);
	console.log(`   ${BASELINE}`);
	process.exit(0);
}

// ── check mode ───────────────────────────────────────────────────────────────
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf-8')) : {};

let newCount = 0;
const newByFile = {};
for (const [file, hits] of Object.entries(current)) {
	const allowed = new Set(baseline[file] ?? []);
	const fresh = hits.filter((h) => !allowed.has(h));
	if (fresh.length) {
		newByFile[file] = fresh;
		newCount += fresh.length;
	}
}

// stale baseline entries (translated/removed since) — reported, not fatal
let staleCount = 0;
for (const [file, hits] of Object.entries(baseline)) {
	const live = new Set(current[file] ?? []);
	const stale = hits.filter((h) => !live.has(h));
	staleCount += stale.length;
}

if (newCount === 0) {
	console.log('✅ No new hardcoded user-facing strings (i18n).');
	if (staleCount)
		console.log(
			`   (${staleCount} baseline entr${staleCount === 1 ? 'y is' : 'ies are'} now stale — run \`make i18n-hardcoded-update\` to prune.)`
		);
	process.exit(0);
}

console.error(
	`❌ ${newCount} new hardcoded user-facing string(s) found (not translated, not in baseline):\n`
);
for (const [file, hits] of Object.entries(newByFile)) {
	console.error(`  ${file}`);
	for (const h of hits) console.error(`      ${h}`);
}
console.error(`
Fix one of these ways:
  • Wrap the string in a Paraglide message:  m['scope.key']()  (add the key to messages/*.json for all locales)
  • If it is genuinely NOT translatable (brand name, code, format token), add an
    \`i18n-ignore\` comment on that line, OR
  • Accept it into the baseline:  make i18n-hardcoded-update   (only for legitimate non-prose)

SEO landing pages (src/routes/(public)/{de,it,fr}, src/lib/data/landing-pages.ts) are intentionally excluded.`);
process.exit(1);
