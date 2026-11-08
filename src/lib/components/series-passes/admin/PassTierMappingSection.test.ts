import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import PassTierMappingSection from './PassTierMappingSection.svelte';
import type { EventInListSchema, TicketTierDetailSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api')>()),
	eventadminticketsListTicketTiers: vi.fn()
}));
import { eventadminticketsListTicketTiers } from '$lib/api';

const event = { id: 'evt-1', name: 'Week 1', start: '2027-01-10T18:00:00Z' } as EventInListSchema;

function tier(id: string, purchasable_by: string, extra: Record<string, unknown> = {}) {
	return {
		id,
		name: `Tier ${id}`,
		price: '10.00',
		currency: 'EUR',
		seat_assignment_mode: 'none',
		price_type: 'fixed',
		purchasable_by,
		restricted_to_membership_tiers: [],
		...extra
	} as unknown as TicketTierDetailSchema;
}

function mockTiers(tiers: TicketTierDetailSchema[]) {
	vi.mocked(eventadminticketsListTicketTiers).mockResolvedValue({
		data: { results: tiers },
		error: undefined,
		response: { ok: true } as Response
	} as never);
}

function renderSection(
	passPurchasableBy: string,
	selections: Record<string, string | null | undefined> = {},
	extra: Record<string, unknown> = {}
) {
	const onSelectionsChange = vi.fn();
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: PassTierMappingSection,
			componentProps: {
				events: [event],
				accessToken: 'tok',
				currency: 'EUR',
				passPurchasableBy,
				selections,
				onSelectionsChange,
				...extra
			}
		}
	});
	return { onSelectionsChange };
}

describe('PassTierMappingSection — stricter-tier compatibility (BE #1332/#1344)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('never defaults to a tier stricter than the pass, even when it is listed first', async () => {
		mockTiers([tier('members-only', 'members'), tier('open', 'public')]);
		const { onSelectionsChange } = renderSection('public');

		await waitFor(() => expect(onSelectionsChange).toHaveBeenCalled());
		expect(onSelectionsChange).toHaveBeenLastCalledWith({ 'evt-1': 'open' });
	});

	it('disables stricter tiers in the select and says why', async () => {
		mockTiers([tier('members-only', 'members'), tier('open', 'public')]);
		renderSection('public', { 'evt-1': 'open' });

		const select = await screen.findByLabelText(/Tier for Week 1/);
		const strict = Array.from((select as HTMLSelectElement).options).find(
			(o) => o.value === 'members-only'
		);
		expect(strict).toBeDisabled();
		expect(strict?.textContent).toMatch(/unavailable: stricter purchase rule/);
		const open = Array.from((select as HTMLSelectElement).options).find((o) => o.value === 'open');
		expect(open).not.toBeDisabled();
		expect(screen.getByText(/Tiers marked unavailable are stricter than this pass/)).toBeVisible();
	});

	it('treats a tier restricted to membership tiers as stricter', async () => {
		mockTiers([
			tier('restricted', 'public', {
				restricted_to_membership_tiers: [{ id: 'mt', name: 'Gold' }]
			}),
			tier('open', 'public')
		]);
		const { onSelectionsChange } = renderSection('public');

		await waitFor(() => expect(onSelectionsChange).toHaveBeenCalled());
		expect(onSelectionsChange).toHaveBeenLastCalledWith({ 'evt-1': 'open' });
	});

	it('allows a non_members tier under a non_members pass', async () => {
		mockTiers([tier('nm', 'non_members')]);
		const nonMembersPass = renderSection('non_members');
		await waitFor(() => expect(nonMembersPass.onSelectionsChange).toHaveBeenCalled());
		expect(nonMembersPass.onSelectionsChange).toHaveBeenLastCalledWith({ 'evt-1': 'nm' });
	});

	it('offers no coverage and explains when every tier is stricter', async () => {
		mockTiers([tier('members-only', 'members'), tier('nm', 'non_members')]);
		const { onSelectionsChange } = renderSection('public');

		expect(await screen.findByTestId('pass-no-compatible-tier')).toHaveTextContent(
			'stricter purchase rule than the pass'
		);
		expect(screen.getByRole('checkbox')).toBeDisabled();
		expect(onSelectionsChange).not.toHaveBeenCalled();
	});

	it('swaps a pick that became incompatible for a compatible tier when the rule changes', async () => {
		mockTiers([tier('open', 'public'), tier('members-only', 'members')]);
		const { onSelectionsChange } = renderSection('public', { 'evt-1': 'members-only' });

		await waitFor(() => expect(onSelectionsChange).toHaveBeenCalled());
		expect(onSelectionsChange).toHaveBeenLastCalledWith({ 'evt-1': 'open' });
	});

	it('shows the server message beside the control as an alert', async () => {
		mockTiers([tier('open', 'public')]);
		renderSection(
			'public',
			{ 'evt-1': 'open' },
			{
				error: "This tier's purchase rule is stricter than the pass's, so the pass cannot cover it."
			}
		);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('stricter than the pass');
		expect(screen.getByTestId('pass-tier-mapping')).toHaveAttribute('aria-describedby', alert.id);
	});

	it('lets the checkbox re-include an excluded event with a compatible tier', async () => {
		mockTiers([tier('members-only', 'members'), tier('open', 'public')]);
		const { onSelectionsChange } = renderSection('public', { 'evt-1': null });

		const checkbox = await screen.findByRole('checkbox');
		await userEvent.click(checkbox);
		expect(onSelectionsChange).toHaveBeenLastCalledWith({ 'evt-1': 'open' });
	});

	it('members -> public -> members restores coverage of a members-only event', async () => {
		mockTiers([tier('members-only', 'members')]);
		const onSelectionsChange = vi.fn();
		let selections: Record<string, string | null | undefined> = { 'evt-1': 'members-only' };
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const view = render(QueryClientTestWrapper, {
			props: {
				client,
				component: PassTierMappingSection,
				componentProps: {
					events: [event],
					accessToken: 'tok',
					currency: 'EUR',
					passPurchasableBy: 'members',
					selections,
					onSelectionsChange
				}
			}
		});
		await screen.findByLabelText(/Tier for Week 1/);

		const props = (passPurchasableBy: string) => ({
			events: [event],
			accessToken: 'tok',
			currency: 'EUR',
			passPurchasableBy,
			selections,
			onSelectionsChange: (next: Record<string, string | null | undefined>) => {
				selections = next;
				onSelectionsChange(next);
			}
		});

		// members -> public: the only tier is now stricter than the pass.
		await view.rerender({ componentProps: props('public') });
		await waitFor(() => expect(onSelectionsChange).toHaveBeenCalled());
		// Dropped to "no choice" (undefined), NOT the explicit-exclusion null.
		expect(selections['evt-1']).toBeUndefined();
		expect(selections['evt-1']).not.toBeNull();

		// public -> members: the pick re-defaults.
		await view.rerender({ componentProps: props('members') });
		await waitFor(() => expect(selections['evt-1']).toBe('members-only'));
	});
});
