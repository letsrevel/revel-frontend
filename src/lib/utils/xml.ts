/**
 * Makes `content` safe to place inside a `<![CDATA[...]]>` section by splitting
 * every `]]>` so untrusted text cannot close the section early and inject markup.
 */
export function escapeCdata(content: string): string {
	return content.replaceAll(']]>', ']]]]><![CDATA[>');
}
