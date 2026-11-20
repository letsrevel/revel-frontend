/**
 * After a successful claim, the pending_event_token cookie must be cleared
 * before the reload, and the reload URL must not carry ?et=. Otherwise the
 * event page reads the token again and shows the claim button instead of the
 * real next step (#1115, #1274).
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
const forgetMock = vi.hoisted(() => vi.fn());
vi.mock('$lib/utils/pending-event-token', () => ({ forgetPendingEventToken: forgetMock }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));

describe('ClaimInvitationButton', () => {
	const originalLocation = window.location;
	const events: string[] = [];
	const replace = vi.fn((url: string) => events.push(`replace:${url}`));

	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		events.length = 0;
		claimMock.mockReset();
		replace.mockClear();
		forgetMock.mockReset();
		forgetMock.mockImplementation(async () => {
			events.push('forget');
		});
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { href: 'http://localhost/events/acme/gala?et=et-1&tab=info', replace }
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
	});

	it('clears the pending token, then reloads without ?et=', async () => {
		claimMock.mockResolvedValue({ data: { id: 'inv-1' }, error: undefined });
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(ClaimInvitationButton, { props: { tokenId: 'et-1' } });

		await user.click(
			screen.getByRole('button', { name: m['claimInvitationButton.claimInvitation']() })
		);
		await vi.waitFor(() => expect(forgetMock).toHaveBeenCalledWith('et-1'));
		await vi.advanceTimersByTimeAsync(1000);

		expect(events).toEqual(['forget', 'replace:http://localhost/events/acme/gala?tab=info']);
	});

	it('does not reload when the user left the page before the reload', async () => {
		claimMock.mockResolvedValue({ data: { id: 'inv-1' }, error: undefined });
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(ClaimInvitationButton, { props: { tokenId: 'et-1' } });

		await user.click(
			screen.getByRole('button', { name: m['claimInvitationButton.claimInvitation']() })
		);
		await vi.waitFor(() => expect(forgetMock).toHaveBeenCalledWith('et-1'));
		window.location.href = 'http://localhost/events';
		await vi.advanceTimersByTimeAsync(1000);

		expect(replace).not.toHaveBeenCalled();
	});

	it('still reloads after an in-page change (#anchor or tab) during the claim', async () => {
		claimMock.mockResolvedValue({ data: { id: 'inv-1' }, error: undefined });
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(ClaimInvitationButton, { props: { tokenId: 'et-1' } });

		await user.click(
			screen.getByRole('button', { name: m['claimInvitationButton.claimInvitation']() })
		);
		await vi.waitFor(() => expect(forgetMock).toHaveBeenCalledWith('et-1'));
		window.location.href = 'http://localhost/events/acme/gala?et=et-1&tab=tickets#tickets';
		await vi.advanceTimersByTimeAsync(1000);

		// The reload uses the URL from the click, without ?et=.
		expect(replace).toHaveBeenCalledWith('http://localhost/events/acme/gala?tab=info');
	});

	it('keeps the pending token and does not reload when the claim fails', async () => {
		claimMock.mockResolvedValue({ data: undefined, error: { message: 'Token used up' } });
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		render(ClaimInvitationButton, { props: { tokenId: 'et-1' } });

		await user.click(
			screen.getByRole('button', { name: m['claimInvitationButton.claimInvitation']() })
		);
		await vi.waitFor(() => expect(claimMock).toHaveBeenCalled());
		await vi.advanceTimersByTimeAsync(1000);

		expect(forgetMock).not.toHaveBeenCalled();
		expect(replace).not.toHaveBeenCalled();
	});
});
