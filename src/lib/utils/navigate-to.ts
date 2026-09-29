/**
 * Full-document navigation, in its own module so pages can mock it (jsdom
 * does not let tests stub `window.location.assign`).
 *
 * Refuses anything that is not `http:`/`https:`: the OAuth consent page
 * follows `redirect_to` values the backend built from a validated client
 * redirect URI, but a defence at the last hop costs nothing.
 */
export function isHttpUrl(url: string): boolean {
	if (!url) return false;
	try {
		const { protocol } = new URL(url, window.location.origin);
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
}

export function navigateTo(url: string): void {
	if (!isHttpUrl(url)) {
		throw new Error(`navigateTo refused a non-http(s) URL: ${url.slice(0, 32)}`);
	}
	window.location.assign(url);
}
