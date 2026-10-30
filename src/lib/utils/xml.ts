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
