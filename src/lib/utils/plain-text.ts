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
	nbsp: ' '
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
		return NAMED_ENTITIES[body.toLowerCase()] ?? match;
	});
}

export function markdownToPlainText(
	markdown: string | null | undefined,
	maxLength?: number
): string {
	if (!markdown) return '';
	let text = markdown.replace(/\r\n?/g, '\n');

	// Fenced code blocks: keep the content, drop the fences.
	text = text.replace(/^ {0,3}(```|~~~)[^\n]*\n([\s\S]*?)(?:\n {0,3}\1[^\n]*(?=\n|$)|$)/gm, '$2');
	// Backslash escapes: swap for NUL-delimited placeholders (NUL cannot occur in stored text) so the emphasis and
	// list passes cannot see the escaped character. Restored at the end.
	text = text.replace(ESCAPABLE, (_m, ch: string) => `${NUL}${ESCAPE_CHARS.indexOf(ch)}${NUL}`);
	// Autolinks <https://…>, <mailto:…>, <me@x.com>: unwrap before tags are stripped.
	text = text.replace(/<((?:https?:\/\/|mailto:|tel:)[^\s<>]*|[^\s<>@:]+@[^\s<>@]+)>/gi, '$1');
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
	text = text.replace(
		/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$/gm,
		''
	);
	text = text.replace(/^\s*\||\|\s*$/gm, '').replace(/[ \t]*\|[ \t]*/g, ' ');
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
