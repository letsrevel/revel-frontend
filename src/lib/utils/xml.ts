/**
 * Makes `content` safe to place inside a `<![CDATA[...]]>` section by splitting
 * every `]]>` so untrusted text cannot close the section early and inject markup.
 */
export function escapeCdata(content: string): string {
	return content.replaceAll(']]>', ']]]]><![CDATA[>');
}

// XML 1.0 forbids these; one stray byte makes a whole feed unparseable.
// eslint-disable-next-line no-control-regex
const XML_ILLEGAL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g;

/** Removes characters that are illegal in XML 1.0 documents. */
export function stripXmlControlChars(value: string): string {
	return value.replace(XML_ILLEGAL_RE, '');
}

/** Decodes the basic named and numeric HTML entities; `&amp;` last so `&amp;lt;` stays `&lt;`. */
export function decodeBasicEntities(value: string): string {
	const code = (n: number): string => {
		try {
			return String.fromCodePoint(n);
		} catch {
			return '';
		}
	};
	return value
		.replace(/&#x([0-9a-fA-F]{1,6});/g, (_, h: string) => code(parseInt(h, 16)))
		.replace(/&#(\d{1,7});/g, (_, d: string) => code(parseInt(d, 10)))
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}
