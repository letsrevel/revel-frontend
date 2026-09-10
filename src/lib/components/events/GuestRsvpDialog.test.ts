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

// Backend #952 / issue #912: the guest_account_exists 400 carries a
// machine-readable `code`; the dialog must offer the sign-in affordance (the
// same one the next_step path renders) instead of a bare error line.
describe('GuestRsvpDialog — guest-action error codes', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		await new Promise((resolve) => setTimeout(resolve, 30));
		document.body.style.pointerEvents = '';
	});

	function mockRsvpError(errorBody: unknown): void {
		eventpublicguestGuestRsvp.mockResolvedValue({
			data: undefined,
			error: errorBody,
			response: { ok: false, status: 400 }
		});
	}

	it('offers sign-in with the entered email prefilled on guest_account_exists', async () => {
		// The detail is deliberately NOT English-shaped: the code, never the
		// text, must drive the affordance (the legacy getLocalizedError path
		// only worked when the backend answered in English).
		mockRsvpError({
			detail: 'Ein Konto mit dieser E-Mail existiert bereits.',
			code: 'guest_account_exists'
		});
		renderDialog();
		await fillAndSubmit();

		await waitFor(() => {
			expect(
				screen.getByText(
					'An account with this email already exists. Please log in to RSVP/purchase tickets.'
				)
			).toBeInTheDocument();
		});
		// The requiresAccount block's own links (the footer "Log in" link is
		// always present, so assert via the create-account link and the login
		// href's returnUrl + prefilled email).
		const createAccount = screen.getByRole('link', { name: 'create an account' });
		expect(createAccount.getAttribute('href')).toContain('returnUrl=');
		const loginLinks = screen
			.getAllByRole('link', { name: 'Log in' })
			.map((link) => link.getAttribute('href'));
		expect(
			loginLinks.some(
				(href) =>
					href?.includes('returnUrl=') &&
					href?.includes(`email=${encodeURIComponent('guest@example.com')}`)
			)
		).toBe(true);
	});

	it('degrades an unknown guest-action code to the verbatim detail with no account affordance', async () => {
		mockRsvpError({ detail: 'A refusal this client does not know yet.', code: 'guest_new_rule' });
		renderDialog();
		await fillAndSubmit();

		await waitFor(() => {
			expect(screen.getByText('A refusal this client does not know yet.')).toBeInTheDocument();
		});
		expect(screen.queryByRole('link', { name: 'create an account' })).toBeNull();
	});
});
