import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import TierForm from './TierForm.svelte';
import type { MembershipTierSchema, TicketTierDetailSchema } from '$lib/api/generated/types.gen';
import { eventadminticketsUpdateTicketTier } from '$lib/api/generated/sdk.gen';

vi.mock('$lib/api/generated/sdk.gen', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/generated/sdk.gen')>()),
	eventadminticketsCreateTicketTier: vi.fn(),
	eventadminticketsUpdateTicketTier: vi.fn(),
	eventadminticketsDeleteTicketTier: vi.fn()
}));

type UpdateResult = Awaited<ReturnType<typeof eventadminticketsUpdateTicketTier>>;

const gold = { id: 'mt-gold', name: 'Gold', kind: 'standard' } as MembershipTierSchema;
const silver = { id: 'mt-silver', name: 'Silver', kind: 'standard' } as MembershipTierSchema;

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
		purchasable_by: 'non_members',
		excluded_membership_tiers: [],
		restricted_to_membership_tiers: [],
		...overrides
	} as TicketTierDetailSchema;
}

function renderForm(tier: TicketTierDetailSchema | null) {
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
				membershipTiers: [gold, silver],
				onClose: vi.fn()
			}
		}
	});
}

function lastBody(): Record<string, unknown> {
	const calls = vi.mocked(eventadminticketsUpdateTicketTier).mock.calls;
	return calls[calls.length - 1][0].body as Record<string, unknown>;
}

describe('TierForm — non-members audience with excluded membership tiers (#1170)', () => {
	beforeEach(() => {
		vi.mocked(eventadminticketsUpdateTicketTier).mockReset();
		vi.mocked(eventadminticketsUpdateTicketTier).mockResolvedValue({
			data: freeTier(),
			error: undefined,
			response: { ok: true, status: 200 } as Response
		} as unknown as UpdateResult);
	});

	it('shows the picker only for the non_members audience, with the help text', async () => {
		renderForm(freeTier({ purchasable_by: 'public' }));
		expect(screen.queryByTestId('tier-excluded-tiers')).toBeNull();

		await userEvent.selectOptions(screen.getByLabelText(/who can purchase/i), 'non_members');

		const picker = screen.getByTestId('tier-excluded-tiers');
		expect(picker).toHaveTextContent('Everyone except members (of the selected tiers).');
		expect(picker).toHaveTextContent('Leave empty to exclude all active members.');
		expect(screen.getByRole('checkbox', { name: 'Gold' })).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: 'Silver' })).toBeInTheDocument();
	});

	it('pre-fills from excluded_membership_tiers and replaces on save', async () => {
		renderForm(freeTier({ excluded_membership_tiers: [gold] }));
		expect(screen.getByRole('checkbox', { name: 'Gold' })).toBeChecked();
		expect(screen.getByRole('checkbox', { name: 'Silver' })).not.toBeChecked();

		await userEvent.click(screen.getByRole('checkbox', { name: 'Silver' }));
		await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

		await waitFor(() => expect(eventadminticketsUpdateTicketTier).toHaveBeenCalled());
		expect(lastBody().excluded_membership_tiers_ids).toEqual(['mt-gold', 'mt-silver']);
		expect(lastBody().purchasable_by).toBe('non_members');
	});

	it('sends [] when the selection is emptied (clears; excludes every active member)', async () => {
		renderForm(freeTier({ excluded_membership_tiers: [gold] }));

		await userEvent.click(screen.getByRole('checkbox', { name: 'Gold' }));
		await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

		await waitFor(() => expect(eventadminticketsUpdateTicketTier).toHaveBeenCalled());
		expect(lastBody().excluded_membership_tiers_ids).toEqual([]);
	});

	it('clears stored exclusions with [] when the audience changes away from non_members', async () => {
		renderForm(freeTier({ excluded_membership_tiers: [gold] }));

		await userEvent.selectOptions(screen.getByLabelText(/who can purchase/i), 'public');
		await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

		await waitFor(() => expect(eventadminticketsUpdateTicketTier).toHaveBeenCalled());
		expect(lastBody().excluded_membership_tiers_ids).toEqual([]);
	});

	it('renders the server message for the exclusion field inline', async () => {
		vi.mocked(eventadminticketsUpdateTicketTier).mockResolvedValue({
			data: undefined,
			error: {
				errors: {
					excluded_membership_tiers_ids: ['Excluded tiers are only valid for non-members tiers.']
				}
			},
			response: { ok: false, status: 400 } as Response
		} as unknown as UpdateResult);
		renderForm(freeTier());

		await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

		const inline = await screen.findByTestId('tier-excluded-error');
		expect(inline).toHaveTextContent('Excluded tiers are only valid for non-members tiers.');
		expect(screen.getByTestId('tier-excluded-tiers')).toHaveAttribute(
			'aria-describedby',
			expect.stringContaining(inline.id)
		);
	});
});
