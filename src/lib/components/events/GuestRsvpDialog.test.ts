import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

	it('drops the stale account affordance when a retry fails for a different reason', async () => {
		mockRsvpError({
			detail: 'An account with this email already exists.',
			code: 'guest_account_exists'
		});
		renderDialog();
		await fillAndSubmit();
		await waitFor(() => {
			expect(screen.getByRole('link', { name: 'create an account' })).toBeInTheDocument();
		});

		// Retry (say, with a corrected email) that fails differently: the
		// account links no longer apply and must not linger.
		mockRsvpError({ detail: 'This event is at capacity.' });
		await fireEvent.click(screen.getByRole('button', { name: /submit rsvp/i }));
		await waitFor(() => {
			expect(screen.getByText('This event is at capacity.')).toBeInTheDocument();
		});
		expect(screen.queryByRole('link', { name: 'create an account' })).toBeNull();
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

// Cloudflare Turnstile (#1242): the real <Turnstile> component renders against
// a stubbed window.turnstile so we can drive its token callback and observe resets.
describe('GuestRsvpDialog — Turnstile', () => {
	const api = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };
	let solve: (token: string) => void;

	beforeEach(async () => {
		vi.clearAllMocks();
		api.render.mockImplementation((_el: HTMLElement, opts: { callback: (t: string) => void }) => {
			solve = opts.callback;
			return 'widget-1';
		});
		window.turnstile = api;
		await new Promise((resolve) => setTimeout(resolve, 30));
		document.body.style.pointerEvents = '';
	});

	afterEach(() => {
		delete window.turnstile;
	});

	async function fillFields(): Promise<void> {
		await fireEvent.input(screen.getByLabelText(/email address/i), {
			target: { value: 'guest@example.com' }
		});
		await fireEvent.input(screen.getByLabelText(/first name/i), { target: { value: 'Guest' } });
		await fireEvent.input(screen.getByLabelText(/last name/i), { target: { value: 'Example' } });
	}

	it('disables submit until a token arrives, then sends turnstile_token', async () => {
		eventpublicguestGuestRsvp.mockResolvedValue({
			data: { message: 'ok' },
			error: undefined,
			response: { ok: true, status: 200 }
		});
		renderDialog({ turnstileSiteKey: 'site-key' });
		await fillFields();
		const submit = screen.getByRole('button', { name: /submit rsvp/i });
		await waitFor(() => expect(api.render).toHaveBeenCalled());
		expect(submit).toBeDisabled();

		solve('ts-tok');
		await waitFor(() => expect(submit).toBeEnabled());
		await fireEvent.click(submit);

		await waitFor(() => {
			expect(eventpublicguestGuestRsvp).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.objectContaining({ turnstile_token: 'ts-tok' })
				})
			);
		});
	});

	it('resets the widget after a failed submission', async () => {
		eventpublicguestGuestRsvp.mockResolvedValue({
			data: undefined,
			error: { detail: 'Bot verification failed. Please try again.' },
			response: { ok: false, status: 400 }
		});
		renderDialog({ turnstileSiteKey: 'site-key' });
		await fillFields();
		await waitFor(() => expect(api.render).toHaveBeenCalled());
		solve('ts-tok');
		const submit = screen.getByRole('button', { name: /submit rsvp/i });
		await waitFor(() => expect(submit).toBeEnabled());
		await fireEvent.click(submit);

		await waitFor(() => expect(api.reset).toHaveBeenCalledWith('widget-1'));
		// The spent token is cleared, so submit is blocked until the widget re-solves.
		await waitFor(() => expect(submit).toBeDisabled());
	});

	it('renders no widget and sends no token without a site key', async () => {
		eventpublicguestGuestRsvp.mockResolvedValue({
			data: { message: 'ok' },
			error: undefined,
			response: { ok: true, status: 200 }
		});
		renderDialog({ turnstileSiteKey: null });
		await fillAndSubmit();

		expect(screen.queryByTestId('turnstile')).toBeNull();
		await waitFor(() => expect(eventpublicguestGuestRsvp).toHaveBeenCalled());
		expect(eventpublicguestGuestRsvp.mock.calls[0][0].body).not.toHaveProperty('turnstile_token');
	});
});
