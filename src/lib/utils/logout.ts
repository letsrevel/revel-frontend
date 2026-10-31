import { resolve } from '$app/paths';
import { authStore } from '$lib/stores/auth.svelte';

/**
 * Sign the user out via a native POST to /logout.
 *
 * Waits for in-flight auth work (bootstrap, token refresh) to settle first: a
 * rotating refresh whose Set-Cookie lands AFTER the logout cleared the cookies
 * would leave the user signed in. `onBeforeSubmit` runs after that wait and
 * right before the submit (clear client-side state there).
 *
 * The form is built on `document.body` so it survives the calling component
 * unmounting, and is a native submit (no fetch) so the 303 ends in a full
 * document load that drops all in-memory state.
 */
export async function postLogout(returnUrl = '', onBeforeSubmit?: () => void): Promise<void> {
	await authStore.waitForAuthSettled();
	onBeforeSubmit?.();

	const form = document.createElement('form');
	form.method = 'POST';
	form.action = resolve('/(public)/logout', {});
	form.hidden = true;

	const input = document.createElement('input');
	input.type = 'hidden';
	input.name = 'returnUrl';
	input.value = returnUrl;
	form.appendChild(input);

	document.body.appendChild(form);
	form.submit();
}
