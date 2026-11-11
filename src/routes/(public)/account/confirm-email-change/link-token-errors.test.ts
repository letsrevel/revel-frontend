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
		expect(screen.getByText(m['confirmEmailChange.error_expired']())).toBeInTheDocument();
		expect(screen.queryByText(m['confirmEmailChange.error_tokenExpired']())).toBeNull();
	});

	it('shows the backend detail for a code-less 400', async () => {
		await renderAfter400({ detail: 'This token has been used.' });
		expect(screen.getByText('This token has been used.')).toBeInTheDocument();
	});

	it('keeps the email-taken copy for the code-less "already in use" refusal', async () => {
		await renderAfter400({ detail: 'That email is already in use.' });
		expect(screen.getByText(m['confirmEmailChange.error_emailTaken']())).toBeInTheDocument();
	});
});
