import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import TierForm from './TierForm.svelte';
import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';
import {
	eventadminticketsCreateTicketTier,
	eventadminticketsUpdateTicketTier
} from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	eventadminticketsCreateTicketTier: vi.fn(),
	eventadminticketsUpdateTicketTier: vi.fn(),
	eventadminticketsDeleteTicketTier: vi.fn()
}));

vi.mock('$lib/components/organization/stripe-connect', () => ({
	requestStripeOnboardingLink: vi.fn()
}));
import { requestStripeOnboardingLink } from '$lib/components/organization/stripe-connect';

type UpdateResult = Awaited<ReturnType<typeof eventadminticketsUpdateTicketTier>>;
type CreateResult = Awaited<ReturnType<typeof eventadminticketsCreateTicketTier>>;

// The generated client resolves (never rejects) with `error` set to the parsed
// response body on HTTP errors — mirror both shapes here.
function ok<T>(data: T) {
	return { data, error: undefined, response: { ok: true, status: 200 } as Response };
}

function apiError(body: unknown, status = 400) {
	return { data: undefined, error: body, response: { ok: false, status } as Response };
}

// Minimal paused ONLINE tier — the shape BE #945 guards: resuming it without
// Stripe Connect now answers 400 StripeNotConnectedError.
const pausedOnlineTier = {
	id: 'tier-1',
	event_id: 'evt-1',
	name: 'General Admission',
	payment_method: 'online',
	price_type: 'fixed',
	price: '25.00',
	currency: 'EUR',
	sales_paused: true,
	seat_assignment_mode: 'none',
	visibility: 'public',
	purchasable_by: 'public'
} as TicketTierDetailSchema;

function renderForm(
	tier: TicketTierDetailSchema | null = pausedOnlineTier,
	extraProps: Record<string, unknown> = {}
) {
	const onClose = vi.fn();
	// Mirrors the app QueryClient: a default mutations.onError (the global
	// "Action failed" toast in +layout.svelte) that skips errors marked
	// `silent: true`. TierForm renders its own inline panel, so its thrown
	// errors must carry that flag.
	const globalOnError = vi.fn();
	const client = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false, onError: globalOnError }
		}
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: TierForm,
			componentProps: {
				tier,
				eventId: 'evt-1',
				organizationSlug: 'acme',
				organizationStripeConnected: true,
				onClose,
				...extraProps
			}
		}
	});
	return { onClose, globalOnError };
}

describe('TierForm API error surfacing', () => {
	beforeEach(() => {
		vi.mocked(eventadminticketsUpdateTicketTier).mockResolvedValue(
			apiError({ detail: 'You must connect to Stripe first.' }) as unknown as UpdateResult
		);
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(
			apiError({ detail: 'You must connect to Stripe first.' }) as unknown as CreateResult
		);
	});

	it('keeps the dialog open and shows the backend detail when an update is rejected', async () => {
		const user = userEvent.setup();
		const { onClose } = renderForm();

		await user.click(screen.getByRole('button', { name: 'Save Changes' }));

		await waitFor(() => expect(eventadminticketsUpdateTicketTier).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.getByText('You must connect to Stripe first.')).toBeInTheDocument()
		);
		expect(onClose).not.toHaveBeenCalled();
	});

	it('marks the thrown error silent so the global "Action failed" toast is suppressed', async () => {
		const user = userEvent.setup();
		const { globalOnError } = renderForm();

		await user.click(screen.getByRole('button', { name: 'Save Changes' }));

		await waitFor(() => expect(globalOnError).toHaveBeenCalled());
		// The inline panel is the only feedback: the global handler must see
		// `silent: true` (the RefundTicketDialog convention) and skip its toast.
		expect(globalOnError.mock.calls[0][0]).toMatchObject({ silent: true });
	});

	it('closes the dialog when the update succeeds', async () => {
		vi.mocked(eventadminticketsUpdateTicketTier).mockResolvedValue(
			ok(pausedOnlineTier) as unknown as UpdateResult
		);
		const user = userEvent.setup();
		const { onClose } = renderForm();

		await user.click(screen.getByRole('button', { name: 'Save Changes' }));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
	});

	it('keeps the dialog open and shows the backend detail when a create is rejected', async () => {
		const user = userEvent.setup();
		const { onClose } = renderForm(null);

		// Fill the name via a direct input event: the dialog also mounts the
		// tiptap MarkdownEditor, which can steal focus mid-`user.type` and
		// swallow keystrokes (flaky in jsdom).
		const nameInput = screen.getByLabelText(/Tier Name/i);
		await fireEvent.input(nameInput, { target: { value: 'Early Bird' } });
		await waitFor(() => expect(nameInput).toHaveValue('Early Bird'));
		const createButton = screen.getByRole('button', { name: 'Create Tier' });
		// The submit button stays disabled until the name state flushes; clicking
		// a still-disabled button is a silent no-op, so wait for it.
		await waitFor(() => expect(createButton).toBeEnabled());
		await user.click(createButton);

		await waitFor(() => expect(eventadminticketsCreateTicketTier).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.getByText('You must connect to Stripe first.')).toBeInTheDocument()
		);
		expect(onClose).not.toHaveBeenCalled();
	});
});

// #1001: with the event's country rules still loading (or failed), a card tier
// can't be vouched for — its save waits; a known-blocked legacy card tier still
// saves (rename / pause are allowed, Journey 29.3).
describe('TierForm — country rules gate', () => {
	beforeEach(() => vi.clearAllMocks());

	it('holds the save of a card tier while the rules are loading', () => {
		renderForm(pausedOnlineTier, { rules: { compliance: null, status: 'loading' } });
		const save = screen.getByRole('button', { name: 'Save Changes' });
		expect(save).toBeDisabled();
		expect(save).toHaveAccessibleDescription(/Checking this event's country rules/);
	});

	it('lets a known-blocked legacy card tier save (rename / pause)', () => {
		renderForm(pausedOnlineTier, {
			rules: {
				compliance: {
					venue_country: 'IT',
					online_payment: 'blocked',
					offline_payment: 'allowed',
					attendee_invoicing: 'allowed',
					notices: []
				},
				status: 'ready'
			}
		});
		expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
	});
});

describe('TierForm event-capacity warning', () => {
	const tierOf40 = { ...pausedOnlineTier, total_quantity: 40 } as TicketTierDetailSchema;

	it('forwards eventCapacity to the availability section and warns when exceeded', () => {
		renderForm(tierOf40, { eventCapacity: 30 });

		expect(screen.getByTestId('tier-capacity-warning')).toBeInTheDocument();
	});

	it('does not warn without an event capacity', () => {
		renderForm(tierOf40);

		expect(screen.queryByTestId('tier-capacity-warning')).not.toBeInTheDocument();
	});
});

describe('TierForm cancellation defaults', () => {
	beforeEach(() => {
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue(
			ok(pausedOnlineTier) as unknown as CreateResult
		);
		vi.mocked(eventadminticketsUpdateTicketTier).mockResolvedValue(
			ok(pausedOnlineTier) as unknown as UpdateResult
		);
	});

	const TOGGLE = /Allow attendees to cancel their tickets/;

	it('defaults the toggle ON for a new free tier', () => {
		renderForm(null);
		expect(screen.getByLabelText(TOGGLE)).toBeChecked();
	});

	it('flips an untouched default OFF when a new tier becomes paid', async () => {
		const user = userEvent.setup();
		renderForm(null);
		await user.selectOptions(screen.getByLabelText(/Payment Method/), 'offline');
		await waitFor(() => expect(screen.getByLabelText(TOGGLE)).not.toBeChecked());
	});

	it('keeps the organizer choice once the toggle was touched', async () => {
		const user = userEvent.setup();
		renderForm(null);
		await user.click(screen.getByLabelText(TOGGLE)); // off
		await user.selectOptions(screen.getByLabelText(/Payment Method/), 'offline');
		await user.selectOptions(screen.getByLabelText(/Payment Method/), 'free');
		expect(screen.getByLabelText(TOGGLE)).not.toBeChecked();
	});

	it('submits cancellation fields for an existing free tier, without a refund policy', async () => {
		const user = userEvent.setup();
		renderForm({
			...pausedOnlineTier,
			payment_method: 'free',
			allow_user_cancellation: true,
			cancellation_deadline_hours: 24,
			refund_policy: null
		} as TicketTierDetailSchema);
		await user.click(screen.getByRole('button', { name: 'Save Changes' }));
		await waitFor(() => expect(eventadminticketsUpdateTicketTier).toHaveBeenCalled());
		const body = vi.mocked(eventadminticketsUpdateTicketTier).mock.calls[0][0].body;
		expect(body).toMatchObject({
			allow_user_cancellation: true,
			cancellation_deadline_hours: 24,
			refund_policy: null
		});
	});
});

describe('TierForm Stripe gate', () => {
	const gated = {
		organizationStripeConnected: false,
		stripeEmail: 'o@acme.test',
		isOwner: true,
		rules: { compliance: null, status: 'ready' }
	};
	const draft = {
		tierId: null,
		name: 'Early Bird',
		description: '',
		paymentMethod: 'online',
		priceType: 'fixed',
		price: '12.50',
		pwycMin: '1',
		pwycMax: '',
		currency: 'EUR',
		vatRateOverride: '',
		manualPaymentInstructions: '',
		totalQuantity: '40',
		salesStartAt: '',
		salesEndAt: '',
		maxTicketsPerUser: '',
		visibility: 'public',
		purchasableBy: 'public'
	};

	beforeEach(() => sessionStorage.clear());

	it('prefills from a restored draft', () => {
		renderForm(null, { ...gated, draft });
		expect(screen.getByLabelText(/Tier Name/i)).toHaveValue('Early Bird');
		expect(screen.getByLabelText(/Payment Method/)).toHaveValue('online');
	});

	it('holds the save while the Stripe gate shows, pointing the button at it', () => {
		renderForm(null, { ...gated, draft });
		const save = screen.getByRole('button', { name: 'Create Tier' });
		expect(save).toBeDisabled();
		expect(save).toHaveAttribute('aria-describedby', 'tier-stripe-gate');
		expect(eventadminticketsCreateTicketTier).not.toHaveBeenCalled();
	});

	it('releases the save once the org is connected and billing is fine', () => {
		renderForm(null, { ...gated, organizationStripeConnected: true, draft });
		expect(screen.getByRole('button', { name: 'Create Tier' })).not.toBeDisabled();
	});

	it('stashes the tier being built before heading to Stripe', async () => {
		const user = userEvent.setup();
		vi.mocked(requestStripeOnboardingLink).mockResolvedValue(window.location.href);
		renderForm(null, { ...gated, draft });
		await user.click(screen.getByRole('button', { name: 'Connect Stripe' }));
		await user.click(await screen.findByRole('button', { name: 'Connect to Stripe' }));
		await waitFor(() => expect(sessionStorage.getItem('revel:tier-draft:evt-1')).not.toBeNull());
		const stashed = JSON.parse(sessionStorage.getItem('revel:tier-draft:evt-1') ?? '{}');
		expect(stashed).toMatchObject({ name: 'Early Bird', paymentMethod: 'online', price: '12.50' });
		expect(requestStripeOnboardingLink).toHaveBeenCalledWith(
			'acme',
			'o@acme.test',
			expect.any(String),
			'event',
			'evt-1'
		);
	});
});
