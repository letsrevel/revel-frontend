import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import TierForm from './TierForm.svelte';
import type { MembershipTierSchema, TicketTierDetailSchema } from '$lib/api/generated/types.gen';
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

const dayPass = { id: 'mt-day', name: 'Door pass', kind: 'temporary' } as MembershipTierSchema;

function freeTier(overrides: Partial<TicketTierDetailSchema> = {}): TicketTierDetailSchema {
	return {
		id: 'tier-1',
		event_id: 'evt-1',
		name: 'Open sale',
		payment_method: 'free',
		price_type: 'fixed',
		price: '0.00',
		currency: 'EUR',
		sales_paused: false,
		seat_assignment_mode: 'none',
		visibility: 'public',
		purchasable_by: 'public',
		max_tickets_per_user: 4,
		excluded_membership_tiers: [],
		restricted_to_membership_tiers: [],
		...overrides
	} as TicketTierDetailSchema;
}

function renderForm(tier: TicketTierDetailSchema | null, extra: Record<string, unknown> = {}) {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({
				defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
			}),
			component: TierForm,
			componentProps: {
				tier,
				eventId: 'evt-1',
				organizationSlug: 'acme',
				organizationStripeConnected: true,
				temporaryTiers: [dayPass],
				onClose: vi.fn(),
				...extra
			}
		}
	});
}

const picker = () => screen.getByLabelText(/grants membership/i) as HTMLSelectElement;
const maxInput = () => document.getElementById('max-tickets-per-user') as HTMLInputElement;

function lastUpdateBody(): Record<string, unknown> {
	const calls = vi.mocked(eventadminticketsUpdateTicketTier).mock.calls;
	return calls[calls.length - 1][0].body as Record<string, unknown>;
}

describe('TierForm "Grants membership" (#1167)', () => {
	beforeEach(() => {
		vi.mocked(eventadminticketsUpdateTicketTier).mockReset();
		vi.mocked(eventadminticketsCreateTicketTier).mockReset();
		vi.mocked(eventadminticketsUpdateTicketTier).mockResolvedValue({
			data: freeTier(),
			error: undefined,
			response: { ok: true, status: 200 } as Response
		} as unknown as UpdateResult);
	});

	it('lists only the temporary tiers it is given, plus "None"', () => {
		renderForm(freeTier());
		const options = Array.from(picker().options).map((o) => o.textContent?.trim());
		expect(options).toEqual(['None', 'Door pass']);
		expect(picker().value).toBe('');
	});

	it('forces max tickets to 1 and locks the field while a grant is set', async () => {
		renderForm(freeTier());
		expect(maxInput().value).toBe('4');

		await userEvent.selectOptions(picker(), 'mt-day');

		expect(maxInput().value).toBe('1');
		expect(maxInput()).toHaveAttribute('readonly');
		const hint = screen.getByTestId('max-tickets-locked-hint');
		expect(maxInput().getAttribute('aria-describedby')).toContain(hint.id);
	});

	it('restores the previous max when the grant is cleared', async () => {
		renderForm(freeTier());
		await userEvent.selectOptions(picker(), 'mt-day');
		await userEvent.selectOptions(picker(), '');

		expect(maxInput().value).toBe('4');
		expect(maxInput()).not.toHaveAttribute('readonly');
	});

	it('disables the member-only audiences while a grant is set, with a hint', async () => {
		renderForm(freeTier());
		const audience = screen.getByLabelText(/who can purchase/i);
		const option = (name: RegExp) => within(audience).getByRole('option', { name });
		expect(option(/^members only$/i)).not.toBeDisabled();

		await userEvent.selectOptions(picker(), 'mt-day');

		expect(option(/^members only$/i)).toBeDisabled();
		expect(option(/invited.*members/i)).toBeDisabled();
		expect(option(/^anyone$/i)).not.toBeDisabled();
		expect(audience.getAttribute('aria-describedby')).toContain('purchasable-by-grants-hint');
	});

	it('disables the picker, with a hint, while the audience is members-only', () => {
		renderForm(freeTier({ purchasable_by: 'members' }));
		expect(picker()).toBeDisabled();
		const hint = screen.getByTestId('tier-grants-blocked');
		expect(picker().getAttribute('aria-describedby')).toContain(hint.id);
	});

	it('pre-fills from grants_membership_tier_id and sends it on update', async () => {
		renderForm(freeTier({ grants_membership_tier_id: 'mt-day', max_tickets_per_user: 1 }));
		expect(picker().value).toBe('mt-day');

		await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

		await waitFor(() => expect(eventadminticketsUpdateTicketTier).toHaveBeenCalled());
		expect(lastUpdateBody().grants_membership_tier_id).toBe('mt-day');
		expect(lastUpdateBody().max_tickets_per_user).toBe(1);
	});

	it('sends null on update when the grant is cleared (omitted would keep it)', async () => {
		renderForm(freeTier({ grants_membership_tier_id: 'mt-day', max_tickets_per_user: 1 }));

		await userEvent.selectOptions(picker(), '');
		await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

		await waitFor(() => expect(eventadminticketsUpdateTicketTier).toHaveBeenCalled());
		expect(lastUpdateBody().grants_membership_tier_id).toBeNull();
	});

	it('omits the field on create when no grant is chosen', async () => {
		vi.mocked(eventadminticketsCreateTicketTier).mockResolvedValue({
			data: freeTier(),
			error: undefined,
			response: { ok: true, status: 201 } as Response
		} as never);
		renderForm(null);

		await userEvent.type(screen.getByLabelText(/tier name/i), 'Open sale');
		await userEvent.click(screen.getByRole('button', { name: 'Create Tier' }));

		await waitFor(() => expect(eventadminticketsCreateTicketTier).toHaveBeenCalled());
		const body = vi.mocked(eventadminticketsCreateTicketTier).mock.calls[0][0].body;
		expect(body).not.toHaveProperty('grants_membership_tier_id');
	});

	it('shows the server error inline under the picker, once', async () => {
		vi.mocked(eventadminticketsUpdateTicketTier).mockResolvedValue({
			data: undefined,
			error: {
				errors: { grants_membership_tier: ['Only a temporary tier can be granted by tickets.'] }
			},
			response: { ok: false, status: 400 } as Response
		} as unknown as UpdateResult);
		renderForm(freeTier());

		await userEvent.selectOptions(picker(), 'mt-day');
		await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

		const inline = await screen.findByTestId('tier-grants-error');
		expect(inline).toHaveTextContent('Only a temporary tier can be granted by tickets.');
		expect(picker().getAttribute('aria-describedby')).toContain(inline.id);
		expect(screen.getAllByText(/Only a temporary tier can be granted/)).toHaveLength(1);
	});

	it('notes that enabling it grants nothing retroactively', () => {
		renderForm(freeTier());
		expect(screen.getByTestId('tier-grants-retroactive')).toHaveTextContent(
			"doesn't grant memberships retroactively"
		);
	});

	it.each(['loading', 'error'] as const)(
		'keeps the stored grant selectable while the tiers query is %s',
		(status) => {
			renderForm(freeTier({ grants_membership_tier_id: 'mt-day', max_tickets_per_user: 1 }), {
				temporaryTiers: [],
				temporaryTiersStatus: status
			});
			expect(picker().value).toBe('mt-day');
			expect(
				screen.getByRole('option', { name: 'Unavailable day-membership tier' })
			).toBeInTheDocument();
		}
	);

	it('shows the load error even when a grant is already set', () => {
		renderForm(freeTier({ grants_membership_tier_id: 'mt-day', max_tickets_per_user: 1 }), {
			temporaryTiers: [],
			temporaryTiersStatus: 'error'
		});
		expect(screen.getByText('Could not load the day-membership tiers.')).toBeInTheDocument();
	});

	it('holds the save with a linked reason while a grant sits on a members-only audience', () => {
		renderForm(
			freeTier({
				grants_membership_tier_id: 'mt-day',
				max_tickets_per_user: 1,
				purchasable_by: 'members'
			})
		);
		const save = screen.getByRole('button', { name: 'Save Changes' });
		expect(save).toBeDisabled();
		const reason = screen.getByTestId('tier-grants-conflict');
		expect(reason).toHaveTextContent(/cannot be limited to members/);
		expect(save.getAttribute('aria-describedby')).toContain(reason.id);
	});

	it('does not hold the save for a consistent grant', () => {
		renderForm(freeTier({ grants_membership_tier_id: 'mt-day', max_tickets_per_user: 1 }));
		expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
		expect(screen.queryByTestId('tier-grants-conflict')).not.toBeInTheDocument();
	});
});
