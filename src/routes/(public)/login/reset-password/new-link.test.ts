import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import Page from './+page.svelte';

// `$app/stores` / `$app/state` reflect nothing outside a SvelteKit navigation.
vi.mock('$app/stores', () => ({
	page: {
		subscribe(fn: (v: { url: URL; data: Record<string, unknown> }) => void) {
			fn({ url: new URL('http://localhost/login/reset-password?token=t'), data: {} });
			return () => {
				// no-op: the URL never changes after render
			};
		}
	}
}));
vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/login/reset-password?token=t'), data: {} }
}));

function renderWith(form: Record<string, unknown>): void {
	render(Page, { props: { form: form as never } });
}

describe('reset-password recovery link for a dead token', () => {
	it('offers "Request new reset link" when the server flags a dead link', () => {
		renderWith({ errors: { form: 'Dead link' }, offerNewLink: true });
		expect(screen.getByText('Dead link')).toBeInTheDocument();
		expect(
			screen.getByRole('link', { name: m['resetPasswordPage.requestNewLink']() })
		).toHaveAttribute('href', '/password-reset');
	});

	it('does not offer it for an unrelated refusal', () => {
		renderWith({ errors: { form: 'Account suspended' }, offerNewLink: false });
		expect(
			screen.queryByRole('link', { name: m['resetPasswordPage.requestNewLink']() })
		).toBeNull();
	});
});
