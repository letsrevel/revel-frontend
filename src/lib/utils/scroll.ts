/**
 * Smooth-scrolls the first form field marked `aria-invalid="true"` into view.
 *
 * Use after a JS validation pass has set `aria-invalid` on the offending
 * inputs — typically from a click handler that has surfaced a toast and now
 * wants to draw the user's eye to the field that needs correction.
 *
 * The selector is intentionally narrow (`[aria-invalid="true"]` only, not
 * `.text-destructive`): error banners and required-field asterisks share the
 * destructive color but are not scroll targets, and matching them would jump
 * the page to the top instead of to the failing input.
 *
 * Wrapped in `requestAnimationFrame` so callers can set state and call this
 * synchronously — the next frame sees the updated DOM.
 */
export function scrollToFirstInvalid(): void {
	if (typeof document === 'undefined') return;
	requestAnimationFrame(() => {
		const el = document.querySelector('[aria-invalid="true"]');
		if (el && 'scrollIntoView' in el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	});
}
