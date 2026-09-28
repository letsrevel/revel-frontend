import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import TierForm from './TierForm.svelte';
import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';
import { eventadminticketsUpdateTicketTier } from '$lib/api/generated/sdk.gen';
import type { TierCheckInEventContext } from './check-in-offset';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	eventadminticketsCreateTicketTier: vi.fn(),
	eventadminticketsUpdateTicketTier: vi.fn(),
	eventadminticketsDeleteTicketTier: vi.fn()
}));

type UpdateResult = Awaited<ReturnType<typeof eventadminticketsUpdateTicketTier>>;

const baseTier = {
	id: 'tier-1',
	event_id: 'evt-1',
	name: 'VIP',
	payment_method: 'free',
	price_type: 'fixed',
	price: '0',
	currency: 'EUR',
	seat_assignment_mode: 'none',
	visibility: 'public',
	purchasable_by: 'public'
} as TicketTierDetailSchema;

const eventContext: TierCheckInEventContext = {
	start: '2026-10-10T20:00',
	end: '2026-10-11T02:00',
	checkInStart: null,
	checkInEnd: null
};

function renderForm(tier: Partial<TicketTierDetailSchema> = {}) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: TierForm,
			componentProps: {
				tier: { ...baseTier, ...tier },
				eventId: 'evt-1',
				organizationSlug: 'acme',
				organizationStripeConnected: false,
				eventContext,
				onClose: vi.fn()
			}
		}
	});
}

function sentBody() {
	const call = vi.mocked(eventadminticketsUpdateTicketTier).mock.calls.at(-1);
	return call?.[0].body;
}

describe('TierForm per-tier check-in window (#945)', () => {
	beforeEach(() => {
		vi.mocked(eventadminticketsUpdateTicketTier).mockReset();
		vi.mocked(eventadminticketsUpdateTicketTier).mockResolvedValue({
			data: baseTier,
			error: undefined,
			response: { ok: true, status: 200 } as Response
		} as unknown as UpdateResult);
	});

	it('explains the fallback and sends null offsets when left empty', async () => {
		const user = userEvent.setup();
		renderForm();

		expect(screen.getAllByText("Defaults to the event's check-in window")).toHaveLength(2);
		await user.click(screen.getByRole('button', { name: 'Save Changes' }));

		await waitFor(() => expect(eventadminticketsUpdateTicketTier).toHaveBeenCalled());
		expect(sentBody()).toMatchObject({ check_in_opens_offset: null, check_in_closes_offset: null });
	});

	it('prefills from a stored Django-form offset and round-trips it verbatim', async () => {
		const user = userEvent.setup();
		renderForm({ check_in_opens_offset: '-P0DT01H00M00S' });

		expect(screen.getByLabelText('Check-in opens')).toHaveValue('2026-10-10T19:00');
		expect(screen.getByText('1 hour before event start')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Save Changes' }));
		await waitFor(() => expect(eventadminticketsUpdateTicketTier).toHaveBeenCalled());
		expect(sentBody()).toMatchObject({
			check_in_opens_offset: '-P0DT01H00M00S',
			check_in_closes_offset: null
		});
	});

	it('converts a picked time into an offset from the event start', async () => {
		const user = userEvent.setup();
		renderForm();

		await fireEvent.input(screen.getByLabelText('Check-in closes'), {
			target: { value: '2026-10-11T10:30' }
		});
		expect(screen.getByText('14 hours 30 minutes after event start')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Save Changes' }));
		await waitFor(() => expect(eventadminticketsUpdateTicketTier).toHaveBeenCalled());
		expect(sentBody()).toMatchObject({ check_in_closes_offset: 'PT14H30M' });
	});

	it('clears an offset back to the event window', async () => {
		const user = userEvent.setup();
		renderForm({ check_in_opens_offset: 'PT2H' });

		await user.click(screen.getByRole('button', { name: 'Clear check-in opening time' }));
		expect(screen.getByLabelText('Check-in opens')).toHaveValue('');
		// The clear button unmounts; focus must land on its input, not <body>.
		await waitFor(() => expect(screen.getByLabelText('Check-in opens')).toHaveFocus());

		await user.click(screen.getByRole('button', { name: 'Save Changes' }));
		await waitFor(() => expect(eventadminticketsUpdateTicketTier).toHaveBeenCalled());
		expect(sentBody()).toMatchObject({ check_in_opens_offset: null });
	});

	it('warns when the resolved window would be empty', async () => {
		renderForm();

		// Opens after the inherited event end (02:00 next day).
		await fireEvent.input(screen.getByLabelText('Check-in opens'), {
			target: { value: '2026-10-11T03:00' }
		});
		expect(screen.getByRole('status')).toHaveTextContent(/close before it opens/);
	});

	it('blocks saving an offset beyond 364 days', async () => {
		renderForm();

		await fireEvent.input(screen.getByLabelText('Check-in closes'), {
			target: { value: '2027-10-10T20:00' }
		});
		expect(screen.getByText('Must be within 364 days of the event start.')).toBeInTheDocument();
		expect(screen.getByLabelText('Check-in closes')).toHaveAttribute('aria-invalid', 'true');
		expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
	});
});
