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
 *   node scripts/check-i18n-hardcoded.mjs --scan f   # scan one file, no baseline (used by the canary)
 */

import { readFileSync, writeFileSync, existsSync, realpathSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = resolve(ROOT, 'scripts/i18n-hardcoded-baseline.json');
const UPDATE = process.argv.includes('--update');
const REPORT = process.argv.includes('--report');
const SCAN = process.argv.indexOf('--scan'); // --scan <file>: scan one file, no baseline (canary)

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

/** 1-based line of offset `idx`, given the line start offsets from `lineIndex`. */
function lineAt(starts, idx) {
	let lo = 0;
	let hi = starts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (starts[mid] <= idx) lo = mid;
		else hi = mid - 1;
	}
	return lo + 1;
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

const REGEX_PREV = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '>']);

/** Index of the end of the string/regex literal starting at `i`; -1 if none starts there or it is unterminated. */
function skipAtom(c, i) {
	const ch = c[i];
	if (ch === "'" || ch === '"' || ch === '`') return skipString(c, i);
	if (ch === '/' && c[i + 1] !== '/' && c[i + 1] !== '*' && c[i + 1] !== '>') {
		let p = i - 1;
		while (p >= 0 && /\s/.test(c[p])) p--;
		// a `/` right after `<` is a closing tag, after `)`/identifier it is a division
		if (p >= 0 && !REGEX_PREV.has(c[p])) return -1;
		return skipRegex(c, i);
	}
	return -1;
}

/** End of the regex literal starting at `i` (handles `[...]` classes and escapes); -1 if unterminated. */
function skipRegex(c, i) {
	let inClass = false;
	for (let j = i + 1; j < c.length; j++) {
		const ch = c[j];
		if (ch === '\n') return -1;
		if (ch === '\\') j++;
		else if (ch === '[') inClass = true;
		else if (ch === ']') inClass = false;
		else if (ch === '/' && !inClass) return j;
	}
	return -1;
}

/** Index of the bracket closing the one at `open`, skipping string and regex literals; -1 if unbalanced. */
function findClose(c, open) {
	const openCh = c[open];
	const closeCh = { '(': ')', '{': '}', '[': ']' }[openCh];
	let depth = 0;
	for (let i = open; i < c.length; i++) {
		const ch = c[i];
		const e = skipAtom(c, i);
		if (e >= 0) {
			i = e;
			continue;
		}
		if ((ch === "'" || ch === '"' || ch === '`') && e < 0) return -1;
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

/** Split `s` on top-level occurrences of `sep` (a single char). */
function splitTop(s, sep = ',') {
	const parts = [];
	let start = 0;
	for (let i = 0; i < s.length; i++) {
		const e = skipAtom(s, i);
		if (e >= 0) i = e;
		else if (s[i] === '(' || s[i] === '{' || s[i] === '[') {
			const close = findClose(s, i);
			if (close < 0) break;
			i = close;
		} else if (s[i] === sep) {
			parts.push(s.slice(start, i));
			start = i + 1;
		}
	}
	parts.push(s.slice(start));
	return parts.filter((a) => a.trim());
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

/**
 * Literals an expression can evaluate to directly: the expression itself, or either
 * branch of a (nested) ternary / `||` / `??` fallback; `$state(..)`/`$derived(..)` unwrapped.
 * Literals inside calls (`foo('x')`, `m.x({ a: 'b' })`) are not branches and are ignored.
 */
function branchLiterals(expr) {
	let e = expr.trim();
	const wrap = /^\$(?:state|derived)(?:<[^>]*>)?\(/.exec(e);
	if (wrap) {
		const close = findClose(e, wrap[0].length - 1);
		if (close > 0) e = e.slice(wrap[0].length, close).trim();
	}
	while (e.startsWith('(') && findClose(e, 0) === e.length - 1) e = e.slice(1, -1).trim();
	const lit = literalValue(e);
	if (lit !== null) return [lit];
	const out = [];
	// split on top-level `?` / `:` / `||` / `??` (conditions on the left yield no literal and are dropped)
	const parts = [];
	let start = 0;
	for (let i = 0; i < e.length; i++) {
		const a = skipAtom(e, i);
		if (a >= 0) i = a;
		else if (e[i] === '(' || e[i] === '{' || e[i] === '[') {
			const close = findClose(e, i);
			if (close < 0) return out;
			i = close;
		} else if (e[i] === '?' && e[i + 1] === '.')
			i++; // optional chaining
		else if (e[i] === '?' || e[i] === ':' || (e[i] === '|' && e[i + 1] === '|')) {
			parts.push(e.slice(start, i));
			if (e[i] === '|' || (e[i] === '?' && e[i + 1] === '?')) i++;
			start = i + 1;
		}
	}
	parts.push(e.slice(start));
	if (parts.length < 2) return out;
	for (const p of parts) {
		const l = literalValue(p);
		if (l !== null) out.push(l);
	}
	return out;
}

/** Blank every call whose opening `name(` matches `re` (to its balanced closing paren), keeping offsets. */
function blankCalls(c, re) {
	const g = new RegExp(re.source, 'g');
	const ranges = [];
	let m;
	while ((m = g.exec(c))) {
		const open = m.index + m[0].length - 1;
		const close = findClose(c, open);
		if (close < 0) continue;
		ranges.push([m.index, close + 1]);
		g.lastIndex = close + 1;
	}
	return blankRanges(c, ranges);
}

/** Blank the given [start, end) ranges in a single pass (newlines kept). */
function blankRanges(c, ranges) {
	if (!ranges.length) return c;
	let out = '';
	let last = 0;
	for (const [a, b] of ranges) {
		out += c.slice(last, a) + blank(c.slice(a, b));
		last = b;
	}
	return out + c.slice(last);
}

/** Calls that are never user-facing: logging, and developer `throw new Error(...)`. */
function blankDevCalls(c) {
	return blankCalls(blankCalls(c, /\b(?:log|logger|console)\.\w+\(/), /\bthrow\s+new\s+\w*Error\(/);
}

/** Words of a literal with `{expr}` placeholders, HTML entities and punctuation removed. */
function proseWords(s) {
	return s
		.replace(/\{[^}]*\}/g, ' ')
		.replace(/&#?\w+;/g, ' ')
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

/** Every sentence literal an object literal can carry, at any depth, ternary values included. */
function objectSentences(objText, out) {
	const t = objText.trim();
	if (!t.startsWith('{')) return;
	for (const prop of splitTop(t.slice(1, findClose(t, 0) < 0 ? undefined : -1))) {
		const pm = /^\s*(?:['"]?[\w$-]+['"]?)\s*:\s*([\s\S]*)$/.exec(prop);
		if (!pm) continue;
		const v = pm[1].trim();
		if (v.startsWith('{')) objectSentences(v, out);
		else for (const lit of branchLiterals(v)) if (isSentence(lit)) out.push(lit);
	}
}

/** Rule 4: `error(status, 'x')`, `error(status, { message: 'x' })`, `fail(status, { key: 'x' })`. */
function scanServerErrors(c, out) {
	const callRe = /(?<![\w.$])(error|fail)\(/g;
	let m;
	while ((m = callRe.exec(c))) {
		const open = m.index + m[0].length - 1;
		const close = findClose(c, open);
		if (close < 0) continue;
		const args = splitTop(c.slice(open + 1, close));
		if (args.length < 2) continue;
		const body = args[1].trim();
		const lits = [];
		if (m[1] === 'error') {
			if (body.startsWith('{')) {
				for (const prop of splitTop(body.slice(1, -1))) {
					const pm = /^\s*message\s*:\s*([\s\S]*)$/.exec(prop);
					if (pm) for (const l of branchLiterals(pm[1])) if (isUiProse(l)) lits.push(l);
				}
			} else for (const l of branchLiterals(body)) if (isUiProse(l)) lits.push(l);
		} else objectSentences(body, lits);
		for (const lit of lits)
			out.push({ finding: `server-error: ${lit.trim()}`, idx: m.index, end: close, lit });
	}
}

/** Rule 5: literal words in a `<svelte:head>` `<title>`. */
function scanTitles(c, out) {
	const headRe = /<svelte:head[\s\S]*?<\/svelte:head>/g;
	let h;
	while ((h = headRe.exec(c))) {
		const titleRe = /<title[^>]*>([\s\S]*?)<\/title>/g;
		let t;
		while ((t = titleRe.exec(h[0]))) {
			const text = t[1]
				.replace(/\{(?:[^{}]|\{[^{}]*\})*\}/g, ' ')
				.replace(/&#?\w+;/g, ' ')
				.replace(/\s+/g, ' ')
				.trim();
			if (proseWords(text).some((w) => !ALLOW_WORDS.has(w.toLowerCase()))) {
				const lit = t[1].replace(/\s+/g, ' ').trim();
				out.push({ finding: `title: ${lit}`, idx: h.index + t.index, lit });
			}
		}
	}
}

/** `message` / `error` string literals among the properties of an object-literal arg (zod 3 / zod 4). */
function zodObjectMessage(arg) {
	const t = arg.trim();
	if (!t.startsWith('{')) return null;
	for (const prop of splitTop(t.slice(1, -1))) {
		const pm = /^\s*(?:message|error)\s*:\s*([\s\S]*)$/.exec(prop); // zod 4 uses `error`
		if (pm) {
			const lit = literalValue(pm[1]);
			if (lit !== null) return lit;
		}
	}
	return null;
}

/**
 * Rule 6: zod validation messages. Only argument lists of zod calls are inspected:
 * `z.*(...)` and the validation methods of a schema chain. A `{ error: '...' }` that is
 * NOT an argument of such a call (a JSON response body, say) is never a zod message.
 */
function scanZod(c, out) {
	if (!/from\s+['"]zod(?:\/[\w-]+)?['"]/.test(c)) return;
	const callRe =
		/(?:(?<![\w$])z\.\w+|\.(?:min|max|length|gt|gte|lt|lte|email|url|uuid|regex|refine|superRefine|nonempty|positive|nonnegative|int|multipleOf|datetime|date|time|ip|check|custom))\(/g;
	let m;
	while ((m = callRe.exec(c))) {
		const open = m.index + m[0].length - 1;
		const close = findClose(c, open);
		if (close < 0) continue;
		const args = splitTop(c.slice(open + 1, close));
		const last = args[args.length - 1];
		if (!last) continue;
		const found = [];
		if (!m[0].startsWith('z.')) {
			const direct = literalValue(last); // `.min(1, 'msg')`
			if (direct !== null) found.push(direct);
		}
		for (const arg of args) {
			const lit = zodObjectMessage(arg);
			if (lit !== null) found.push(lit);
		}
		for (const lit of found)
			if (isUiProse(lit))
				out.push({ finding: `zod: ${lit.trim()}`, idx: m.index, end: close, lit });
	}
}

/** Rule 7: string literals in `aria-label={...}` / `placeholder={...}` / `title={...}` / `alt={...}`. */
function scanAttrExpressions(c, out) {
	const re = new RegExp(`(?<![\\w:.$-])(${ATTRS.join('|')})=\\{`, 'g');
	let m;
	while ((m = re.exec(c))) {
		const open = m.index + m[0].length - 1;
		const close = findClose(c, open);
		if (close < 0) continue;
		const expr = blankCalls(c.slice(open + 1, close), /\bm(?:\.\w+|\[[^\]]+\])\(/);
		for (let i = 0; i < expr.length; i++) {
			const e = skipAtom(expr, i);
			if (e < 0) continue;
			if (expr[i] !== '/') {
				const lit = flattenTemplate(expr.slice(i + 1, e));
				if (isUiProse(lit))
					out.push({
						finding: `attr-expr: ${m[1]}={... '${lit.trim()}' ...}`,
						idx: m.index,
						end: close,
						lit
					});
			}
			i = e;
		}
	}
}

/** Index where the expression starting at `from` ends: top-level `;`, `,`, unmatched closer, or a finished line. */
function exprEnd(c, from) {
	while (from < c.length && /\s/.test(c[from])) from++; // the value may start on the next line
	for (let i = from; i < c.length; i++) {
		const e = skipAtom(c, i);
		if (e >= 0) {
			i = e;
			continue;
		}
		const ch = c[i];
		if (ch === '(' || ch === '{' || ch === '[') {
			const close = findClose(c, i);
			if (close < 0) return c.length;
			i = close;
		} else if (ch === ';' || ch === ',' || ch === ')' || ch === '}' || ch === ']') return i;
		else if (ch === '\n') {
			const before = c.slice(from, i).trimEnd();
			const after = c.slice(i).trimStart();
			if (!/[?:|&+]$/.test(before) && !/^[?:|&+]/.test(after)) return i;
		}
	}
	return c.length;
}

/** Rule 8: sentence-like literals assigned to UI-copy-named variables / properties. */
function scanCopyAssignments(c, out) {
	// `name =` (declaration, assignment, `this.name =`, after `if (..)` / `=>`) or `name:` (object property)
	const re = /(?<![\w$])([A-Za-z_$][\w$]*)\s*(?::[^=;(){}\n'"`]*)?(=(?![=>])|:(?!:))/g;
	let m;
	while ((m = re.exec(c))) {
		const name = m[1];
		if (!COPY_NAME_RE.test(name)) continue;
		if (m[2] === ':') {
			// property position only: `{ label: ..`, `, label: ..` or first token on its line
			const before = c.slice(0, m.index).trimEnd();
			if (!/[{,]$/.test(before) && !/(^|\n)\s*$/.test(c.slice(0, m.index))) continue;
		}
		const start = m.index + m[0].length;
		const expr = c.slice(start, exprEnd(c, start));
		for (const lit of branchLiterals(expr))
			if (isSentence(lit))
				out.push({ finding: `copy: ${name} = ${lit.trim()}`, idx: m.index, lit, copy: true });
	}
}

/** Blank everything outside `<script>` bodies (offsets and lines preserved). */
function scriptBodiesOnly(c) {
	const ranges = [];
	let last = 0;
	const re = /(<script[^>]*>)([\s\S]*?)(<\/script>)/g;
	let m;
	while ((m = re.exec(c))) {
		const bodyStart = m.index + m[1].length;
		ranges.push([last, bodyStart]);
		last = bodyStart + m[2].length;
	}
	ranges.push([last, c.length]);
	return blankRanges(c, ranges);
}

/** Line start offsets for O(log n) offset -> line lookups. */
function lineIndex(content) {
	const starts = [0];
	for (let i = 0; i < content.length; i++) if (content[i] === '\n') starts.push(i + 1);
	return starts;
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
	const isSvelte = file.endsWith('.svelte');
	const withHead = strip(content, file, true); // comments/<style> blanked, <svelte:head> kept (for <title>)
	const c = isSvelte
		? withHead.replace(/<svelte:head[\s\S]*?<\/svelte:head>/g, blank) // SEO meta/JSON-LD
		: withHead;
	const found = new Set();
	const starts = lineIndex(content);
	const lines = content.split('\n');
	const ignored = (idx) => {
		const line = lineAt(starts, idx);
		return /i18n-ignore/.test(lines[line - 1] ?? '') || /i18n-ignore/.test(lines[line - 2] ?? '');
	};
	const push = (str, idx) => {
		if (!ignored(idx)) found.add(str.trim());
	};

	let m;
	ATTR_RE.lastIndex = 0;
	while ((m = ATTR_RE.exec(c))) if (!isNonProse(m[2])) push(`${m[1]}="${m[2].trim()}"`, m.index);
	TOAST_RE.lastIndex = 0;
	while ((m = TOAST_RE.exec(c))) if (!isNonProse(m[3])) push(`toast: ${m[3].trim()}`, m.index);
	if (isSvelte) {
		const markup = stripScriptBodies(c);
		TEXT_RE.lastIndex = 0;
		while ((m = TEXT_RE.exec(markup)))
			if (isProseTextNode(m[1])) push(`text: ${m[1].trim()}`, m.index);
	}

	// Structural rules (4-8). Dev-only calls are masked first so their literals never count.
	const dev = blankDevCalls(c);
	const hits = [];
	if (SERVER_FILE_RE.test(file)) scanServerErrors(dev, hits);
	if (isSvelte) scanTitles(withHead, hits);
	scanZod(dev, hits);
	scanAttrExpressions(dev, hits);
	// `+server.ts` endpoints answer machines (JSON bodies), not people: no copy rule there.
	if (!/\/\+server\.ts$/.test(file))
		scanCopyAssignments(isSvelte ? scriptBodiesOnly(dev) : dev, hits);
	// `i18n-ignore` is applied per occurrence BEFORE dedup, so an ignored line can never
	// suppress an identical literal elsewhere. A broader `copy:` finding is dropped only
	// when a call-based rule (error()/fail()/zod/attr) reported the same literal from the
	// call expression that contains it.
	const live = hits.filter((h) => !ignored(h.idx));
	const calls = live.filter((h) => !h.copy && h.end !== undefined);
	for (const h of live) {
		if (
			h.copy &&
			calls.some((x) => x.lit.trim() === h.lit.trim() && h.idx >= x.idx && h.idx <= x.end)
		)
			continue;
		push(h.finding, h.idx);
	}
	return [...found].sort();
}

// ── CLI ──────────────────────────────────────────────────────────────────────
// Guarded: the unit tests import `scanSource` from this module, and importing it
// must not shell out to git or call process.exit.
function main() {
	// ── --scan <file>: scan exactly that file against no baseline; exit 1 on any finding ──
	if (SCAN > -1) {
		const target = process.argv[SCAN + 1];
		const hits = scanSource(readFileSync(resolve(target), 'utf-8'), target);
		for (const h of hits) console.log(h);
		process.exit(hits.length ? 1 : 0);
	}
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

// Compare REAL paths: the ESM loader realpaths `import.meta.url`, so a symlinked
// invocation (macOS /tmp -> /private/tmp, symlinked checkouts) would otherwise skip
// main() and exit 0 having scanned nothing. `make i18n-hardcoded-canary` guards this.
function isEntry() {
	if (!process.argv[1]) return false;
	try {
		return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
	} catch {
		return false;
	}
}

if (isEntry()) {
	main();
}
