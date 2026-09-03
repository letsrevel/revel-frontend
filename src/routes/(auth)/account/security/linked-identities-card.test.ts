import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent, PointerEventsCheckLevel } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import LinkedIdentitiesCard from './linked-identities-card.svelte';

// bits-ui's dialog scroll-lock sets `pointer-events: none` on <body> while
// open and releases it asynchronously (not synchronously with the portal
// unmount) — in jsdom that release can outlive one test and block pointer
// interaction with the next test's rendered button. Every `userEvent.setup()`
// below opts out of the check rather than asserting on that implementation
// detail (the standard testing-library workaround for Radix/bits-ui dialogs).
vi.mock('$lib/api/client', () => ({
	accountListIdentities: vi.fn(),
	accountUnlinkIdentity: vi.fn()
}));

import { accountListIdentities, accountUnlinkIdentity } from '$lib/api/client';

const identities = [
	{
		provider: 'keycloak',
		provider_name: 'Keycloak (e2e)',
		email: 'user@example.com',
		created_at: '2026-09-01T10:00:00Z'
	}
];

let queryClient: QueryClient;

function renderCard() {
	return render(QueryClientTestWrapper, {
		props: {
			client: queryClient,
			component: LinkedIdentitiesCard,
			componentProps: { authToken: 'token-123' }
		}
	});
}

beforeEach(() => {
	queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	vi.mocked(accountListIdentities).mockReset();
	vi.mocked(accountUnlinkIdentity).mockReset();
});

describe('LinkedIdentitiesCard', () => {
	it('lists linked identities', async () => {
		vi.mocked(accountListIdentities).mockResolvedValue({
			data: identities,
			error: undefined,
			response: { ok: true }
		} as never);

		renderCard();

		expect(await screen.findByText('Keycloak (e2e)')).toBeTruthy();
		expect(screen.getByText('user@example.com')).toBeTruthy();
	});

	it('shows the empty state when nothing is linked', async () => {
		vi.mocked(accountListIdentities).mockResolvedValue({
			data: [],
			error: undefined,
			response: { ok: true }
		} as never);

		renderCard();

		expect(await screen.findByText('No linked sign-in methods.')).toBeTruthy();
	});

	it('unlinks after confirming in the dialog', async () => {
		const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
		vi.mocked(accountListIdentities).mockResolvedValue({
			data: identities,
			error: undefined,
			response: { ok: true }
		} as never);
		vi.mocked(accountUnlinkIdentity).mockResolvedValue({
			data: undefined,
			error: undefined,
			response: { ok: true, status: 204 }
		} as never);

		renderCard();

		await user.click(await screen.findByRole('button', { name: 'Unlink Keycloak (e2e)' }));
		await user.click(await screen.findByRole('button', { name: 'Unlink', exact: true }));

		await waitFor(() => {
			expect(accountUnlinkIdentity).toHaveBeenCalledWith(
				expect.objectContaining({ path: { provider: 'keycloak' } })
			);
		});
		// Let the dialog fully close before the test ends — otherwise its
		// scroll-lock body style can outlive the unmount and block pointer
		// interaction with the next test's rendered button.
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull();
		});
	});

	it('can cancel the unlink dialog without mutating', async () => {
		const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
		vi.mocked(accountListIdentities).mockResolvedValue({
			data: identities,
			error: undefined,
			response: { ok: true }
		} as never);

		renderCard();

		await user.click(await screen.findByRole('button', { name: 'Unlink Keycloak (e2e)' }));
		expect(await screen.findByRole('dialog')).toBeTruthy();

		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull();
		});
		expect(accountUnlinkIdentity).not.toHaveBeenCalled();
	});

	it('can dismiss the unlink dialog with Escape without mutating', async () => {
		const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
		vi.mocked(accountListIdentities).mockResolvedValue({
			data: identities,
			error: undefined,
			response: { ok: true }
		} as never);

		renderCard();

		await user.click(await screen.findByRole('button', { name: 'Unlink Keycloak (e2e)' }));
		expect(await screen.findByRole('dialog')).toBeTruthy();

		await user.keyboard('{Escape}');

		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull();
		});
		expect(accountUnlinkIdentity).not.toHaveBeenCalled();
	});

	it('surfaces the backend detail when unlink is refused (400)', async () => {
		const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
		vi.mocked(accountListIdentities).mockResolvedValue({
			data: identities,
			error: undefined,
			response: { ok: true }
		} as never);
		vi.mocked(accountUnlinkIdentity).mockResolvedValue({
			data: undefined,
			error: { detail: 'Set a password before unlinking your only sign-in method.' },
			response: { ok: false, status: 400 }
		} as never);

		renderCard();

		await user.click(await screen.findByRole('button', { name: 'Unlink Keycloak (e2e)' }));
		await user.click(await screen.findByRole('button', { name: 'Unlink', exact: true }));

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('Set a password before unlinking');
	});
});
