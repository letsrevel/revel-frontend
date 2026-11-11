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
 * What it flags (the ways untranslated copy reaches users). Every finding is
 * recorded as `<rule>: <literal>` (or `attr="literal"` / `text: ...` / `toast: ...`):
 *   1. `toast.success|error|info|warning|loading|message('literal')`       toast:
 *   2. user-facing attributes: aria-label / placeholder / title / alt = "literal"
 *   3. visible text nodes:  >Some Text<                                    text:
 *   4. server errors: `error(<status>, 'literal')` / `error(<status>, { message: 'literal' })`
 *      and `fail(<status>, { key: 'literal' })` in `*.server.ts`, `+page.ts`, `+layout.ts`
 *      and `src/lib/server/**`. `fail` values must read as a sentence (>=2 words)    server-error:
 *   5. `<svelte:head>` `<title>`: literal words outside `{expr}`, separators and the
 *      brand name. `<meta>`/`<link>`/JSON-LD in the head are still skipped            title:
 *   6. zod messages (files importing `zod`): `.min|max|length|email|url|uuid|regex|
 *      refine|superRefine|...(…, 'literal')` and `{ message: 'literal' }`           zod:
 *   7. string literals inside attribute EXPRESSIONS: `aria-label={c ? 'A' : 'B'}`,
 *      `title={'X'}`, `placeholder={`Search ${x}`}` for aria-label / placeholder /
 *      title / alt. Literals inside `m.*()` calls and lone lowercase tokens skipped  attr-expr:
 *   8. sentence-like literals assigned to names that suggest UI copy
 *      (`/(error|message|label|title|description|heading|text|placeholder)$/i`):
 *      `errorMessage = 'Failed to load'`, `{ label: 'Create Event' }`, in `.ts` files
 *      and Svelte `<script>` bodies. Sentence heuristic: >=2 words, starts with a
 *      capital letter, not ALL-CAPS (spares enums, CSS classes, ids, URLs)  copy:
 *   Never flagged: `log.*(` / `console.*(` calls and `throw new Error(` (developer
 *   errors; a user-facing error goes through SvelteKit `error()`, rule 4).
 *
 * Excluded (never scanned):
 *   - SEO landing pages: src/routes/(public)/{de,it,fr,es,pt}/**, src/lib/data/landing-pages/
 *   - generated / paraglide / data / *.test.* / *.spec.* / *.d.ts / *.example.*
 *   - <style> blocks, <svelte:head> blocks (except <title>, rule 5), HTML/JS comments
 *   - <script> bodies, for rule 3 only (rules 1 and 2 still scan them)
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
 *   node scripts/check-i18n-hardcoded.mjs --report   # every finding, ignoring the baseline
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = resolve(ROOT, 'scripts/i18n-hardcoded-baseline.json');
const UPDATE = process.argv.includes('--update');
const REPORT = process.argv.includes('--report');

const EXCLUDE = [
	/\/paraglide\//,
	/\/api\/generated\//,
	/\/lib\/data\/landing-pages\//,
	/\/routes\/\(public\)\/(de|it|fr|es|pt)\//, // localized SEO landing pages
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

function strip(content, file, keepHead = false) {
	let c = content;
	c = c.replace(/<style[\s\S]*?<\/style>/g, blank);
	if (!keepHead) c = c.replace(/<svelte:head[\s\S]*?<\/svelte:head>/g, blank); // SEO meta/JSON-LD (<title> is read from the raw source, see scanTitles)
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

/**
 * Blank `<script>` bodies, leaving the surrounding markup (and line numbers) intact.
 *
 * Only for the bare-text-node pass. TEXT_RE looks for `>text<`, which in a script
 * body matches things that are not markup at all: the `>` of an arrow function opens
 * a match that runs to the next literal `<` — often the closing `</script>` — so an
 * entire script tail gets reported as one hardcoded string (#730). A text-node match
 * inside script is a false positive by construction; string literals in script are
 * ATTR_RE's and TOAST_RE's job, and those still scan the whole file.
 */
function stripScriptBodies(content) {
	return content.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g, (_, open, body, close) => {
		return open + blank(body) + close;
	});
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

// ── shared helpers for the structural rules (4-8) ─────────────────────────────

/** Index of the bracket closing the one at `open`, skipping string literals; -1 if unbalanced. */
function findClose(c, open) {
	const openCh = c[open];
	const closeCh = { '(': ')', '{': '}', '[': ']' }[openCh];
	let depth = 0;
	for (let i = open; i < c.length; i++) {
		const ch = c[i];
		if (ch === "'" || ch === '"' || ch === '`') {
			i = skipString(c, i);
			if (i < 0) return -1;
			continue;
		}
		if (ch === openCh) depth++;
		else if (ch === closeCh && --depth === 0) return i;
	}
	return -1;
}

/** Index of the closing quote of the string starting at `i`; -1 if unterminated. */
function skipString(c, i) {
	const q = c[i];
	for (let j = i + 1; j < c.length; j++) {
		if (c[j] === '\\') j++;
		else if (c[j] === q) return j;
		else if (q === '`' && c[j] === '$' && c[j + 1] === '{') {
			const end = findClose(c, j + 1);
			if (end < 0) return -1;
			j = end;
		} else if (q !== '`' && c[j] === '\n') return -1;
	}
	return -1;
}

/** Split the inside of a call on top-level commas. */
function splitArgs(inner) {
	const args = [];
	let start = 0;
	for (let i = 0; i < inner.length; i++) {
		const ch = inner[i];
		if (ch === "'" || ch === '"' || ch === '`') {
			const e = skipString(inner, i);
			if (e < 0) break;
			i = e;
		} else if (ch === '(' || ch === '{' || ch === '[') {
			const e = findClose(inner, i);
			if (e < 0) break;
			i = e;
		} else if (ch === ',') {
			args.push(inner.slice(start, i));
			start = i + 1;
		}
	}
	args.push(inner.slice(start));
	return args.filter((a) => a.trim());
}

/** The value of `arg` if it is exactly one string literal (template `${}` become `{x}`), else null. */
function literalValue(arg) {
	const t = arg.trim();
	const q = t[0];
	if (q !== "'" && q !== '"' && q !== '`') return null;
	if (skipString(t, 0) !== t.length - 1) return null;
	return flattenTemplate(t.slice(1, -1));
}

function flattenTemplate(body) {
	let out = '';
	for (let i = 0; i < body.length; i++) {
		if (body[i] === '$' && body[i + 1] === '{') {
			const e = findClose(body, i + 1);
			if (e < 0) break;
			out += '{x}';
			i = e;
		} else out += body[i];
	}
	return out;
}

/** Blank every call whose opening `name(` matches `re` (to its balanced closing paren), keeping offsets. */
function blankCalls(c, re) {
	let out = c;
	const g = new RegExp(re.source, 'g');
	let m;
	while ((m = g.exec(c))) {
		const open = m.index + m[0].length - 1;
		const close = findClose(c, open);
		if (close < 0) continue;
		out = out.slice(0, m.index) + blank(out.slice(m.index, close + 1)) + out.slice(close + 1);
	}
	return out;
}

/** Calls that are never user-facing: logging, and developer `throw new Error(...)`. */
function blankDevCalls(c) {
	let out = blankCalls(c, /\b(?:log|logger|console)\.\w+\(/);
	out = blankCalls(out, /\bthrow\s+new\s+\w*Error\(/);
	return out;
}

/** Words of a literal with `{expr}` placeholders and punctuation removed. */
function proseWords(s) {
	return s
		.replace(/\{[^}]*\}/g, ' ')
		.split(/[\s|·•–—:,;.!?()/-]+/)
		.filter((w) => /[A-Za-z]{2,}/.test(w));
}

/** A literal that reads as UI copy: not a token/identifier/URL and not only brand words. */
function isUiProse(raw) {
	if (isNonProse(raw)) return false;
	const noTokens = raw.replace(/\{[^}]*\}/g, ' ').trim();
	if (/^[a-z][\w.:/#-]*$/.test(noTokens)) return false; // lone lowercase token / kebab id
	if (/^[-_+.][\w.-]+$/.test(noTokens)) return false; // '-start'-style API tokens
	if (/^[#./]/.test(noTokens) && !/\s/.test(noTokens)) return false; // selector / path
	return proseWords(raw).some((w) => !ALLOW_WORDS.has(w.toLowerCase()));
}

/** Sentence heuristic for property/variable copy: >=2 words, capitalised, not ALL-CAPS. */
export function isSentence(raw) {
	const s = raw.trim();
	if (isNonProse(s)) return false;
	if (!/^[A-Z]/.test(s)) return false;
	if (/^https?:|\/\//.test(s)) return false;
	const words = proseWords(s);
	if (words.length < 2) return false;
	return words.some((w) => /[a-z]/.test(w)); // not ALL-CAPS
}

const SERVER_FILE_RE = /(\.server\.ts$|\/\+page\.ts$|\/\+layout\.ts$|\/lib\/server\/)/;
const COPY_NAME_RE = /(error|message|label|title|description|heading|text|placeholder)$/i;

/** Rule 4: `error(404, 'x')`, `error(404, { message: 'x' })`, `fail(400, { key: 'x' })`. */
function scanServerErrors(c, out) {
	const errRe = /(?<![\w.$])error\(\s*\d{3}\s*,/g;
	let m;
	while ((m = errRe.exec(c))) {
		const open = c.indexOf('(', m.index);
		const close = findClose(c, open);
		if (close < 0) continue;
		const arg = splitArgs(c.slice(open + 1, close))[1];
		if (!arg) continue;
		let lit = literalValue(arg);
		if (lit === null && arg.trim().startsWith('{')) {
			for (const prop of splitArgs(arg.trim().slice(1, -1))) {
				const pm = /^\s*message\s*:\s*([\s\S]*)$/.exec(prop);
				if (pm) lit = literalValue(pm[1]);
			}
		}
		if (lit !== null && isUiProse(lit)) out.push([`server-error: ${lit.trim()}`, m.index]);
	}
	const failRe = /(?<![\w.$])fail\(\s*\d{3}\s*,/g;
	while ((m = failRe.exec(c))) {
		const open = c.indexOf('(', m.index);
		const close = findClose(c, open);
		if (close < 0) continue;
		const arg = splitArgs(c.slice(open + 1, close))[1];
		if (!arg || !arg.trim().startsWith('{')) continue;
		for (const prop of splitArgs(arg.trim().slice(1, -1))) {
			const pm = /^\s*['"]?[\w$-]+['"]?\s*:\s*([\s\S]*)$/.exec(prop);
			if (!pm) continue;
			const lit = literalValue(pm[1]);
			if (lit !== null && isSentence(lit)) out.push([`server-error: ${lit.trim()}`, m.index]);
		}
	}
}

/** Rule 5: literal words in a `<svelte:head>` `<title>`. */
function scanTitles(content, file, out) {
	const c = strip(content, file, true);
	const headRe = /<svelte:head[\s\S]*?<\/svelte:head>/g;
	let h;
	while ((h = headRe.exec(c))) {
		const titleRe = /<title[^>]*>([\s\S]*?)<\/title>/g;
		let t;
		while ((t = titleRe.exec(h[0]))) {
			const text = t[1]
				.replace(/\{(?:[^{}]|\{[^{}]*\})*\}/g, ' ')
				.replace(/\s+/g, ' ')
				.trim();
			if (proseWords(text).some((w) => !ALLOW_WORDS.has(w.toLowerCase()))) {
				out.push([`title: ${t[1].replace(/\s+/g, ' ').trim()}`, h.index + t.index]);
			}
		}
	}
}

/** Rule 6: zod validation messages. */
function scanZod(c, out) {
	if (!/from\s+['"]zod(?:\/[\w-]+)?['"]/.test(c)) return;
	const callRe =
		/\.(min|max|length|gt|gte|lt|lte|email|url|uuid|regex|refine|superRefine|nonempty|positive|nonnegative|int|multipleOf|datetime|date|time|ip|check|custom)\(/g;
	let m;
	while ((m = callRe.exec(c))) {
		const open = m.index + m[0].length - 1;
		const close = findClose(c, open);
		if (close < 0) continue;
		const args = splitArgs(c.slice(open + 1, close));
		const last = args[args.length - 1];
		if (!last) continue;
		let lit = literalValue(last);
		if (lit === null && last.trim().startsWith('{')) {
			for (const prop of splitArgs(last.trim().slice(1, -1))) {
				const pm = /^\s*message\s*:\s*([\s\S]*)$/.exec(prop);
				if (pm) lit = literalValue(pm[1]);
			}
		}
		if (lit !== null && isUiProse(lit)) out.push([`zod: ${lit.trim()}`, m.index]);
	}
	const msgRe = /(?<![\w$])message\s*:\s*(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
	while ((m = msgRe.exec(c))) {
		const lit = flattenTemplate(m[2]);
		if (isUiProse(lit)) out.push([`zod: ${lit.trim()}`, m.index]);
	}
}

/** Rule 7: string literals in `aria-label={...}` / `placeholder={...}` / `title={...}` / `alt={...}`. */
function scanAttrExpressions(c, out) {
	const re = new RegExp(`\\b(?:${ATTRS.join('|')})=\\{`, 'g');
	let m;
	while ((m = re.exec(c))) {
		const open = m.index + m[0].length - 1;
		const close = findClose(c, open);
		if (close < 0) continue;
		const expr = blankCalls(c.slice(open + 1, close), /\bm(?:\.\w+|\[[^\]]+\])\(/);
		for (let i = 0; i < expr.length; i++) {
			const ch = expr[i];
			if (ch !== "'" && ch !== '"' && ch !== '`') continue;
			const e = skipString(expr, i);
			if (e < 0) break;
			const lit = flattenTemplate(expr.slice(i + 1, e));
			if (isUiProse(lit))
				out.push([`attr-expr: ${m[0].slice(0, -2)}={... '${lit.trim()}' ...}`, m.index]);
			i = e;
		}
	}
}

/** Rule 8: sentence-like literals assigned to UI-copy-named variables / properties. */
function scanCopyAssignments(c, out) {
	const re =
		/(?:^|[{,;(])\s*(?:(?:export\s+)?(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?(=(?![=>])|:(?!:))\s*(?:\$(?:state|derived)(?:<[^>]*>)?\()?(['"`])((?:\\.|(?!\3)[^\\\n])*)\3/gm;
	let m;
	while ((m = re.exec(c))) {
		if (!COPY_NAME_RE.test(m[1])) continue;
		const lit = flattenTemplate(m[4]);
		if (isSentence(lit)) out.push([`copy: ${m[1]} = ${lit.trim()}`, m.index + m[0].indexOf(m[1])]);
	}
}

/** Blank everything outside `<script>` bodies (offsets and lines preserved). */
function scriptBodiesOnly(c) {
	let out = '';
	let last = 0;
	const re = /(<script[^>]*>)([\s\S]*?)(<\/script>)/g;
	let m;
	while ((m = re.exec(c))) {
		const bodyStart = m.index + m[1].length;
		out += blank(c.slice(last, bodyStart)) + m[2];
		last = bodyStart + m[2].length;
	}
	return out + blank(c.slice(last));
}

function scanFile(file) {
	let content;
	try {
		content = readFileSync(resolve(ROOT, file), 'utf-8');
	} catch {
		return [];
	}
	return scanSource(content, file);
}

/** The pure half of `scanFile` — exported so the rules can be unit-tested. */
export function scanSource(content, file) {
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
	const isSvelte = file.endsWith('.svelte');
	if (isSvelte) {
		const markup = stripScriptBodies(c);
		TEXT_RE.lastIndex = 0;
		while ((m = TEXT_RE.exec(markup)))
			if (isProseTextNode(m[1])) push(`text: ${m[1].trim()}`, m.index);
	}

	// Structural rules (4-8). Dev-only calls are masked first so their literals never count.
	const dev = blankDevCalls(c);
	const hits = []; // [finding, offset]
	if (SERVER_FILE_RE.test(file)) scanServerErrors(dev, hits);
	if (isSvelte) scanTitles(content, file, hits);
	scanZod(dev, hits);
	scanAttrExpressions(dev, hits);
	// `+server.ts` endpoints answer machines (JSON bodies), not people: no copy rule there.
	if (!/\/\+server\.ts$/.test(file))
		scanCopyAssignments(isSvelte ? scriptBodiesOnly(dev) : dev, hits);
	const seen = [];
	for (const [finding, idx] of hits) {
		// a literal an earlier rule already reported is not repeated by the broader `copy:` rule
		const lit = finding.replace(/^[a-z-]+: (?:\w+ = )?/, '');
		if (finding.startsWith('copy:') && seen.some((x) => x.includes(lit))) continue;
		seen.push(finding);
		push(finding, idx);
	}
	return [...found].sort();
}

// ── CLI ──────────────────────────────────────────────────────────────────────
// Guarded: the unit tests import `scanSource` from this module, and importing it
// must not shell out to git or call process.exit.
function main() {
	// ── gather source files ────────────────────────────────────────────────────
	const files = execSync('git ls-files src', { cwd: ROOT, encoding: 'utf-8' })
		.split('\n')
		.filter(Boolean)
		.filter(
			(f) => (f.endsWith('.svelte') || f.endsWith('.ts')) && !EXCLUDE.some((re) => re.test(f))
		);

	const current = {};
	for (const f of files) {
		const hits = scanFile(f);
		if (hits.length) current[f] = hits;
	}

	// ── report mode: every finding per rule, ignoring the baseline ─────────────
	if (REPORT) {
		const byRule = {};
		for (const [file, hits] of Object.entries(current))
			for (const h of hits) {
				const rule = /^(toast|text|server-error|title|zod|attr-expr|copy):/.exec(h)?.[1] ?? 'attr';
				(byRule[rule] ??= []).push(`${file}: ${h}`);
			}
		for (const [rule, list] of Object.entries(byRule)) {
			console.log(`\n## ${rule} (${list.length})`);
			for (const l of list) console.log(l);
		}
		process.exit(0);
	}

	if (UPDATE) {
		writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
		const total = Object.values(current).reduce((a, h) => a + h.length, 0);
		console.log(
			`✅ Wrote baseline: ${total} accepted literal(s) across ${Object.keys(current).length} file(s).`
		);
		console.log(`   ${BASELINE}`);
		process.exit(0);
	}

	// ── check mode ─────────────────────────────────────────────────────────────
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

SEO landing pages (src/routes/(public)/{de,it,fr,es,pt}, src/lib/data/landing-pages/) are intentionally excluded.`);
	process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
