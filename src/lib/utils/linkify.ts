export type LinkifySegment = { type: 'text'; value: string } | { type: 'link'; value: string };

// http(s) URLs up to the next whitespace. Trailing sentence punctuation and an
// unbalanced closing bracket are trimmed off below, so "see https://x.io.",
// "(https://x.io)" or "[https://x.io]" link only the URL itself.
const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;
const BRACKET_PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

function hasUnbalancedClosingBracket(url: string): boolean {
	const close = url.at(-1);
	const open = close ? BRACKET_PAIRS[close] : undefined;
	return open !== undefined && count(url, open) < count(url, close as string);
}

function trimUrl(raw: string): string {
	let url = raw.replace(TRAILING_PUNCTUATION, '');
	while (hasUnbalancedClosingBracket(url)) {
		url = url.slice(0, -1).replace(TRAILING_PUNCTUATION, '');
	}
	return url;
}

function count(str: string, char: string): number {
	return str.split(char).length - 1;
}

/**
 * Split plain text into text and link segments so URLs can be rendered as
 * anchors without `{@html}`. Only http(s) URLs are linked, so the result is
 * safe to bind to `href`.
 */
export function linkify(text: string): LinkifySegment[] {
	const segments: LinkifySegment[] = [];
	let cursor = 0;

	for (const match of text.matchAll(URL_PATTERN)) {
		const start = match.index;
		const url = trimUrl(match[0]);
		if (url.length <= 'https://'.length) continue;

		if (start > cursor) segments.push({ type: 'text', value: text.slice(cursor, start) });
		segments.push({ type: 'link', value: url });
		cursor = start + url.length;
	}

	if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) });
	return segments;
}
