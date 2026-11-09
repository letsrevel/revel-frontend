import { untrack } from 'svelte';
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
		let active = true;
		// The handler usually reads and writes reactive state. Attachments re-run
		// when anything read synchronously inside them changes, so the handler must
		// never run in the attachment's tracking scope.
		const fire = (): void => {
			if (active) untrack(handler);
		};

		img.addEventListener('error', fire);

		// Already settled before hydration. `naturalWidth === 0` alone is not proof
		// of failure: an SVG without intrinsic dimensions loads fine with both
		// naturalWidth and naturalHeight at 0. Confirm with decode(), which rejects
		// for a broken image and resolves for a usable one.
		if (
			img.complete &&
			img.naturalWidth === 0 &&
			img.naturalHeight === 0 &&
			img.currentSrc !== ''
		) {
			if (typeof img.decode === 'function') {
				img.decode().then(
					() => undefined,
					() => fire()
				);
			} else {
				queueMicrotask(fire);
			}
		}

		return () => {
			active = false;
			img.removeEventListener('error', fire);
		};
	};
}
