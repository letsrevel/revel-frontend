import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as m from '$lib/paraglide/messages.js';

const confirm = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({ accountEmailChangeConfirm: confirm }));
vi.mock('$lib/utils/cookies', () => ({
	getAccessTokenCookieOptions: () => ({ path: '/' }),
	getRefreshTokenCookieOptions: () => ({ path: '/' }),
	getClientCookieOptions: () => ({ path: '/' })
}));
vi.mock('$lib/server/tenant-canonical', () => ({
	resolveReturnTarget: vi.fn().mockResolvedValue(null)
}));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

// `$app/stores`'s real `page` reflects nothing outside a SvelteKit navigation.
vi.mock('$app/stores', () => ({
	page: {
		subscribe(fn: (v: { url: URL; data: Record<string, unknown> }) => void) {
			fn({ url: new URL('http://localhost/account/confirm-email-change?token=t'), data: {} });
			return () => {
				// no-op: the URL never changes after render
			};
		}
	}
}));

import { actions } from './+page.server';
import Page from './+page.svelte';

function run(): ReturnType<typeof actions.confirmEmailChange> {
	const body = new FormData();
	body.set('token', 'tok-123');
	return actions.confirmEmailChange({
		request: new Request('http://localhost/account/confirm-email-change', {
			method: 'POST',
			body
		}),
		cookies: { get: vi.fn(), set: vi.fn() },
		fetch: vi.fn()
	} as unknown as Parameters<typeof actions.confirmEmailChange>[0]);
}

/** Run the action against a 400, then render the page with the action's data. */
async function renderAfter400(error: unknown): Promise<void> {
	confirm.mockResolvedValue({
		data: undefined,
		error,
		response: new Response(null, { status: 400 })
	});
	const result = (await run()) as { data: Record<string, unknown> };
	render(Page, { props: { form: result.data as never } });
}

beforeEach(() => confirm.mockReset());

describe('confirm-email-change typed link-token errors (BE #1373)', () => {
	it('shows the expired copy for code token_expired', async () => {
		await renderAfter400({ detail: 'Token has expired.', code: 'token_expired' });
		expect(screen.getByText(m['confirmEmailChange.error_tokenExpired']())).toBeInTheDocument();
		expect(screen.getByRole('link', { name: m['confirmEmailChange.error_cta']() })).toBeVisible();
	});

	it('shows the invalid copy for code invalid_token', async () => {
		await renderAfter400({ detail: 'Invalid token.', code: 'invalid_token' });
		expect(screen.getByText(m['confirmEmailChange.error_invalid']())).toBeInTheDocument();
		expect(screen.queryByText(m['confirmEmailChange.error_tokenExpired']())).toBeNull();
		expect(screen.queryByText(m['confirmEmailChange.error_expired']())).toBeNull();
	});

	it('shows the backend detail for a code-less 400', async () => {
		await renderAfter400({ detail: 'This token has been used.' });
		expect(screen.getByText('This token has been used.')).toBeInTheDocument();
	});

	it('shows the (already localized) backend detail for "email already in use", in any locale', async () => {
		await renderAfter400({ detail: 'Questa email è già in uso.' });
		expect(screen.getByText('Questa email è già in uso.')).toBeInTheDocument();
	});

	it('does not force an English Accept-Language: the shared client sends the UI locale', async () => {
		await renderAfter400({ detail: 'x' });
		expect(confirm.mock.calls[0][0]).not.toHaveProperty('headers');
	});

	it('shows the backend detail for a 403 (address banned meanwhile)', async () => {
		confirm.mockResolvedValue({
			data: undefined,
			error: { detail: 'Questo indirizzo non è consentito.' },
			response: new Response(null, { status: 403 })
		});
		const result = (await run()) as { data: Record<string, unknown> };
		render(Page, { props: { form: result.data as never } });
		expect(screen.getByText('Questo indirizzo non è consentito.')).toBeInTheDocument();
	});

	it('treats the legacy code-less "Invalid token:" detail as invalid, hiding the raw text', async () => {
		await renderAfter400({ detail: 'Invalid token: boom' });
		expect(screen.getByText(m['confirmEmailChange.error_invalid']())).toBeInTheDocument();
		expect(screen.queryByText(/boom/)).toBeNull();
	});

	it('shows the dedicated "email taken" copy and CTA for code email_taken (BE #1375)', async () => {
		await renderAfter400({ detail: 'Questa email è già in uso.', code: 'email_taken' });
		expect(screen.getByText(m['confirmEmailChange.error_emailTaken']())).toBeInTheDocument();
		expect(screen.queryByText('Questa email è già in uso.')).toBeNull();
		const cta = screen.getByRole('link', { name: m['confirmEmailChange.error_cta']() });
		expect(cta).toHaveAttribute('href', '/account/security');
	});

	it('shows the superseded copy and a link to security settings for email_change_superseded', async () => {
		await renderAfter400({ detail: 'Cancelled.', code: 'email_change_superseded' });
		expect(screen.getByText(m['confirmEmailChange.error_superseded']())).toBeInTheDocument();
		expect(screen.queryByText('Cancelled.')).toBeNull();
		const cta = screen.getByRole('link', { name: m['confirmEmailChange.error_cta']() });
		expect(cta).toHaveAttribute('href', '/account/security');
	});

	it('classifies by the email-change code even when the detail has the legacy "Invalid token:" prefix', async () => {
		await renderAfter400({ detail: 'Invalid token: stale', code: 'email_taken' });
		expect(screen.getByText(m['confirmEmailChange.error_emailTaken']())).toBeInTheDocument();
		expect(screen.queryByText(m['confirmEmailChange.error_invalid']())).toBeNull();
	});
});
