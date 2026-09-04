import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GuestRsvpDialog from './GuestRsvpDialog.svelte';

const eventpublicguestGuestRsvp = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicguestGuestRsvp
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { isAuthenticated: false, accessToken: null }
}));

// fireEvent rather than userEvent: bits-ui's dialog scroll lock leaves body
// pointer-events toggling on its own timers, which makes userEvent's pointer
// simulation flaky for the second dialog rendered in one file. fireEvent
// drives bind:value and form submission deterministically.
async function fillAndSubmit(): Promise<void> {
	await fireEvent.input(screen.getByLabelText(/email address/i), {
		target: { value: 'guest@example.com' }
	});
	await fireEvent.input(screen.getByLabelText(/first name/i), { target: { value: 'Guest' } });
	await fireEvent.input(screen.getByLabelText(/last name/i), { target: { value: 'Example' } });
	await fireEvent.click(screen.getByRole('button', { name: /submit rsvp/i }));
}

function renderDialog(props: Record<string, unknown> = {}): void {
	render(GuestRsvpDialog, {
		props: {
			open: true,
			eventId: 'event-1',
			onClose: vi.fn(),
			...props
		}
	});
}

// Backend #923: the guest RSVP endpoint claims an invitation-link token sent
// via X-Event-Token before eligibility checks run. The dialog must forward the
// token the event page was loaded with.
describe('GuestRsvpDialog — invitation-link token header', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		eventpublicguestGuestRsvp.mockResolvedValue({
			data: { message: 'Check your email' },
			error: undefined,
			response: { ok: true, status: 200 }
		});
		// bits-ui restores body state on a ~24ms timer after a dialog unmounts;
		// let the previous test's teardown finish before rendering a new dialog,
		// then clear the scroll lock it left behind (same trick as
		// MembershipCta.test.ts / vitest.setup.ts).
		await new Promise((resolve) => setTimeout(resolve, 30));
		document.body.style.pointerEvents = '';
	});

	it('sends X-Event-Token when an event token is present', async () => {
		renderDialog({ eventToken: 'tok-123' });
		await fillAndSubmit();

		await waitFor(() => {
			expect(eventpublicguestGuestRsvp).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: { 'X-Event-Token': 'tok-123' }
				})
			);
		});
	});

	it('sends no X-Event-Token header without a token', async () => {
		renderDialog();
		await fillAndSubmit();

		await waitFor(() => {
			expect(eventpublicguestGuestRsvp).toHaveBeenCalled();
		});
		const options = eventpublicguestGuestRsvp.mock.calls[0][0];
		expect(options.headers ?? {}).not.toHaveProperty('X-Event-Token');
	});
});
