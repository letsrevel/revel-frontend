import { waitFor } from '@testing-library/svelte';
import { expect } from 'vitest';

/**
 * bits-ui's dialog focus-scope moves focus in a mount-time `requestAnimationFrame`;
 * under CPU contention that frame can land mid-typing and swallow keystrokes
 * (PR③ Task 12 root cause). In jsdom nothing is "tabbable" (every element
 * measures 0×0), so the scope falls back to focusing the content container — a
 * plain `div` — which then eats the rest of the word. Await this before the
 * first `userEvent` interaction with a freshly-rendered dialog.
 *
 * The gate is a proxy: it assumes the focus-scope frame is the only mount-time
 * focus mover, so "focus has left `<body>`" means "the steal already happened".
 * Call sites that need to pin focus to a *specific* element should await this
 * first and then assert that element themselves.
 */
export async function focusSettled(): Promise<void> {
	await waitFor(() => expect(document.body).not.toHaveFocus());
}
