import type { Attachment } from 'svelte/attachments';

/**
 * Attachment that calls `handler` when an `<img>` fails to load.
 *
 * Use this instead of `onerror={...}` on `<img>`. Svelte server-renders
 * `<img onerror>` as an inline `onerror="this.__e=event"` attribute (event
 * replay for hydration), which the nonce-based production CSP blocks with
 * "Executing inline event handler violates script-src" (#1193). An attachment
 * runs only on the client and registers a real listener, so no inline handler
 * reaches the DOM.
 *
 * It also catches images that already failed before hydration finished, which
 * the inline attribute was meant to replay.
 */
export function onImageError(handler: () => void): Attachment<HTMLImageElement> {
	return (img) => {
		img.addEventListener('error', handler);
		if (img.complete && img.naturalWidth === 0 && img.currentSrc !== '') {
			handler();
		}
		return () => img.removeEventListener('error', handler);
	};
}
