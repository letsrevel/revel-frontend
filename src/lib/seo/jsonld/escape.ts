/**
 * Serialize an object to JSON-LD safe for embedding inside <script type="application/ld+json">.
 * Escapes "</" so a malicious value cannot close the script tag.
 */
export function toJsonLd(data: object): string {
	try {
		return JSON.stringify(data).replace(/</g, '\\u003c');
	} catch (err) {
		console.error('[seo/jsonld] serialization failed:', err);
		return '{}';
	}
}
