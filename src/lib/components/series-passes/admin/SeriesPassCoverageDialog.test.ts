import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import SeriesPassCoverageDialog from './SeriesPassCoverageDialog.svelte';
import type {
	EventInListSchema,
	SeriesPassAdminSchema,
	TicketTierDetailSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api')>()),
	eventadminticketsListTicketTiers: vi.fn(),
	seriespassadminAddSeriesPassTierLinks: vi.fn(),
	seriespassadminRemoveSeriesPassTierLink: vi.fn()
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { eventadminticketsListTicketTiers, seriespassadminAddSeriesPassTierLinks } from '$lib/api';

const event = { id: 'evt-2', name: 'Week 2', start: '2027-01-17T18:00:00Z' } as EventInListSchema;
const pass = {
	id: 'pass-1',
	name: 'Season',
	currency: 'EUR',
	purchasable_by: 'members',
	tier_links: []
} as unknown as SeriesPassAdminSchema;

describe('SeriesPassCoverageDialog — stricter-tier 400 (#1172)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(eventadminticketsListTicketTiers).mockResolvedValue({
			data: {
				results: [
					{
						id: 'tier-a',
						name: 'Members',
						price: '5.00',
						currency: 'EUR',
						seat_assignment_mode: 'none',
						price_type: 'fixed',
						purchasable_by: 'members',
						restricted_to_membership_tiers: []
					} as unknown as TicketTierDetailSchema
				]
			},
			error: undefined,
			response: { ok: true } as Response
		} as never);
	});

	it('shows the server refusal inline next to the tier controls instead of a toast', async () => {
		const message =
			"This tier's purchase rule is stricter than the pass's, so the pass cannot cover it.";
		vi.mocked(seriespassadminAddSeriesPassTierLinks).mockResolvedValue({
			data: undefined,
			error: { errors: { tier: [message] } },
			response: { ok: false, status: 400 } as Response
		} as never);
		render(QueryClientTestWrapper, {
			props: {
				client: new QueryClient({
					defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
				}),
				component: SeriesPassCoverageDialog,
				componentProps: {
					seriesId: 'series-1',
					pass,
					accessToken: 'tok',
					upcomingEvents: [event],
					onClose: vi.fn()
				}
			}
		});

		await userEvent.click(await screen.findByRole('button', { name: /extend coverage \(1\)/i }));

		const alert = await screen.findByTestId('pass-tier-error');
		expect(alert).toHaveTextContent(message);
		expect(alert).toHaveAttribute('role', 'alert');
	});
});
