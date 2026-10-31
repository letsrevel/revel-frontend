/**
 * Open a URL in a new tab with `noopener,noreferrer`.
 *
 * `window.open(url, '_blank')` keeps `window.opener`, so a page we don't
 * control (organizer-supplied links, signed download URLs) could redirect the
 * Revel tab. With `noopener` the call returns `null`, so use this only when
 * the returned window is not needed. ESLint bans bare `window.open`.
 */
export function openInNewTab(url: string): void {
	// eslint-disable-next-line no-restricted-properties -- this is the sanctioned wrapper
	window.open(url, '_blank', 'noopener,noreferrer');
}
