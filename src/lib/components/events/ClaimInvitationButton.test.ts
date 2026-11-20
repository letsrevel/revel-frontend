/**
 * After a successful claim, the pending_event_token cookie must be cleared
 * before the reload. Otherwise the event page reads the token from the cookie
 * again and shows the claim button instead of the real next step (#1115, #1274).
 */
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ClaimInvitationButton from './ClaimInvitationButton.svelte';
import * as m from '$lib/paraglide/messages.js';

const claimMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicdiscoveryClaimInvitation: claimMock
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));

describe('ClaimInvitationButton', () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		claimMock.mockReset();
		fetchMock.mockReset();
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('clears the pending event token after a successful claim', async () => {
		claimMock.mockResolvedValue({ data: { id: 'inv-1' }, error: undefined });
		const user = userEvent.setup();
		render(ClaimInvitationButton, { props: { tokenId: 'et 1/x' } });

		await user.click(
			screen.getByRole('button', { name: m['claimInvitationButton.claimInvitation']() })
		);

		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
		expect(fetchMock).toHaveBeenCalledWith('/api/events/pending-token?token=et%201%2Fx', {
			method: 'DELETE'
		});
	});

	it('keeps the pending event token when the claim fails', async () => {
		claimMock.mockResolvedValue({ data: undefined, error: { message: 'Token used up' } });
		const user = userEvent.setup();
		render(ClaimInvitationButton, { props: { tokenId: 'et-1' } });

		await user.click(
			screen.getByRole('button', { name: m['claimInvitationButton.claimInvitation']() })
		);

		await vi.waitFor(() => expect(claimMock).toHaveBeenCalled());
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
