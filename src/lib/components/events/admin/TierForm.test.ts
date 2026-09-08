import { render, screen, waitFor } from '@testing-library/svelte';
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

function renderForm(tier: TicketTierDetailSchema | null = pausedOnlineTier) {
	const onClose = vi.fn();
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: TierForm,
			componentProps: {
				tier,
				eventId: 'evt-1',
				organizationSlug: 'acme',
				organizationStripeConnected: false,
				onClose
			}
		}
	});
	return { onClose };
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

		await user.type(screen.getByLabelText(/Tier Name/i), 'Early Bird');
		await user.click(screen.getByRole('button', { name: 'Create Tier' }));

		await waitFor(() => expect(eventadminticketsCreateTicketTier).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.getByText('You must connect to Stripe first.')).toBeInTheDocument()
		);
		expect(onClose).not.toHaveBeenCalled();
	});
});
