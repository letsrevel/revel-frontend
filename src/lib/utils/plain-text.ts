/**
 * Markdown/HTML to plain text for short previews (calendar popup, cards).
 * Pure string processing, no DOM, so it is safe during SSR. Event
 * descriptions are stored as nh3-sanitized Markdown, so they can contain
 * Markdown syntax, a few HTML tags and HTML entities.
 */

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
	mdash: '\u2014',
	ndash: '\u2013',
	hellip: '\u2026',
	laquo: '\u00ab',
	raquo: '\u00bb',
	lsquo: '\u2018',
	rsquo: '\u2019',
	ldquo: '\u201c',
	rdquo: '\u201d',
	bull: '\u2022',
	middot: '\u00b7',
	copy: '\u00a9',
	reg: '\u00ae',
	trade: '\u2122',
	euro: '\u20ac',
	pound: '\u00a3',
	deg: '\u00b0',
	times: '\u00d7',
	shy: ''
};

const ESCAPE_CHARS = '\\`*_{}[]()#+-.!|<>~&';
const NUL = String.fromCharCode(0);
const PLACEHOLDER = new RegExp(`${NUL}(\\d+)${NUL}`, 'g');
const ESCAPABLE = /\\([\\`*_{}[\]()#+\-.!|<>~&])/g;

export function decodeHtmlEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
		if (body[0] === '#') {
			const code =
				body[1] === 'x' || body[1] === 'X'
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
			try {
				return String.fromCodePoint(code);
			} catch {
				return match;
			}
		}
		const key = body.toLowerCase();
		return Object.hasOwn(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : match;
	});
}

/**
 * Drop fenced code block fences, keep their content. Line-based, following
 * CommonMark: an opening fence is 3+ backticks or tildes (an info string may
 * follow); the closing fence uses the same character, is at least as long, and
 * has only whitespace after it. An unclosed block runs to the end of input.
 */
function stripFences(text: string): string {
	const out: string[] = [];
	let open: { ch: string; len: number } | null = null;
	for (const line of text.split('\n')) {
		const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
		if (open) {
			if (m && m[1][0] === open.ch && m[1].length >= open.len && /^[ \t]*$/.test(m[2])) {
				open = null;
			} else {
				out.push(line);
			}
		} else if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
			open = { ch: m[1][0], len: m[1].length };
		} else {
			out.push(line);
		}
	}
	return out.join('\n');
}

const TABLE_DELIMITER = /^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/;

/**
 * Flatten Markdown tables: a table is a header line, a delimiter row (which
 * must contain a pipe, e.g. `|---|---|` or `--- | ---`) and the body lines up
 * to the next blank line. Pipes are only stripped inside those blocks, so
 * "Rock | Pop | Jazz" in ordinary prose is left alone.
 */
function flattenTables(text: string): string {
	const lines = text.split('\n');
	const inTable = new Array<boolean>(lines.length).fill(false);
	const isDelimiter = new Array<boolean>(lines.length).fill(false);
	for (let i = 1; i < lines.length; i++) {
		if (!lines[i].includes('|') || !TABLE_DELIMITER.test(lines[i])) continue;
		if (lines[i - 1].trim() === '') continue;
		isDelimiter[i] = true;
		inTable[i - 1] = true;
		for (let j = i; j < lines.length && lines[j].trim() !== ''; j++) inTable[j] = true;
	}
	const out: string[] = [];
	lines.forEach((line, i) => {
		if (isDelimiter[i]) return;
		out.push(
			inTable[i] ? line.replace(/^\s*\||\|\s*$/g, '').replace(/[ \t]*\|[ \t]*/g, ' ') : line
		);
	});
	return out.join('\n');
}

export function markdownToPlainText(
	markdown: string | null | undefined,
	maxLength?: number
): string {
	if (!markdown) return '';
	let text = markdown.replace(/\r\n?/g, '\n');

	// Fenced code blocks: keep the content, drop the fences.
	text = stripFences(text);
	// Backslash escapes: swap for NUL-delimited placeholders (NUL cannot occur in stored text) so the emphasis and
	// list passes cannot see the escaped character. Restored at the end.
	text = text.replace(ESCAPABLE, (_m, ch: string) => `${NUL}${ESCAPE_CHARS.indexOf(ch)}${NUL}`);
	// Autolinks <https://…>, <mailto:…>, <me@x.com>: unwrap before tags are stripped.
	text = text.replace(
		/<((?:[a-z][a-z0-9+.-]*:\/\/|(?:mailto|tel|sms|geo):)[^\s<>]*|[^\s<>@:]+@[^\s<>@]+)>/gi,
		'$1'
	);
	// Images: keep alt text. Links: keep link text. Reference-style definitions: drop.
	text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
	text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
	text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
	text = text.replace(/^ {0,3}\[[^\]]+\]:\s*\S.*$/gm, '');
	// HTML comments and tags (before entity decoding so decoded `<` survives).
	text = text.replace(/<!--[\s\S]*?-->/g, '');
	text = text.replace(/<\/?[a-z][^>]*>/gi, ' ');
	// Block-level markers.
	text = text.replace(/^ {0,3}#{1,6}\s+/gm, '');
	text = text.replace(/^ {0,3}(?:[-*_]\s*){3,}$/gm, '');
	text = text.replace(/^[ \t]*>+[ \t]?/gm, '');
	text = text.replace(/^[ \t]*(?:[-*+]|\d{1,3}[.)])\s+(?:\[[ xX]\]\s+)?/gm, '');
	text = flattenTables(text);
	// Inline emphasis / code / strike.
	text = text.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '$1');
	text = text.replace(/(?<!\w)__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1');
	text = text.replace(/\*(?=\S)([^\n*]*?\S)\*/g, '$1');
	text = text.replace(/(?<!\w)_(?=\S)([^\n_]*?\S)_(?!\w)/g, '$1');
	text = text.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1');
	text = text.replace(/`+([^`]*)`+/g, '$1');

	text = decodeHtmlEntities(text);
	// Restore escaped punctuation.
	text = text.replace(PLACEHOLDER, (m, i: string) => ESCAPE_CHARS[Number(i)] ?? m);
	text = text.replace(/\s+/g, ' ').trim();

	if (maxLength !== undefined && text.length > maxLength) {
		text = text.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
	}
	return text;
}
