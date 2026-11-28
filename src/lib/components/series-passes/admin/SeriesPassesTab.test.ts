import { render, screen, waitFor, within } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import SeriesPassesTab from './SeriesPassesTab.svelte';
import type { SeriesPassAdminSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api')>()),
	seriespassadminListSeriesPasses: vi.fn(),
	seriespassadminDeleteSeriesPass: vi.fn(),
	eventadminticketsListTicketTiers: vi.fn()
}));
import { seriespassadminListSeriesPasses } from '$lib/api';

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NOW = Date.parse('2027-01-01T00:00:00Z');

function link(id: string, event_start: string) {
	return { id, event_id: `e-${id}`, tier_id: `t-${id}`, event_start };
}

function makePass(overrides: Record<string, unknown> = {}): SeriesPassAdminSchema {
	return {
		id: 'pass-1',
		name: 'Season',
		description: null,
		price: '30.00',
		pro_rata_discount: '0',
		currency: 'EUR',
		payment_method: 'online',
		purchasable_by: 'public',
		visibility: 'public',
		is_active: true,
		sales_start_at: null,
		sales_end_at: null,
		total_quantity: null,
		holder_count: 0,
		tier_links: [
			link('1', '2027-02-01T18:00:00Z'),
			link('2', '2027-03-01T18:00:00Z'),
			link('3', '2027-04-01T18:00:00Z')
		],
		...overrides
	} as unknown as SeriesPassAdminSchema;
}

function mockPasses(passes: SeriesPassAdminSchema[]) {
	vi.mocked(seriespassadminListSeriesPasses).mockResolvedValue({
		data: passes,
		error: undefined,
		response: { ok: true } as Response
	} as never);
}

function renderTab(extra: Record<string, unknown> = {}) {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: SeriesPassesTab,
			componentProps: {
				seriesId: 'series-1',
				accessToken: 'tok',
				canEdit: true,
				upcomingEvents: [],
				now: NOW,
				...extra
			}
		}
	});
}

describe('SeriesPassesTab setting warnings (#1314)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('shows a Warn (A3) inside the saved pass when the organization is restricted', async () => {
		mockPasses([makePass()]);
		renderTab({ organizationVisibility: 'private' });

		const list = await screen.findByTestId('series-pass-warnings-pass-1');
		await waitFor(() =>
			expect(within(list).getByText('Pass that most people cannot see')).toBeInTheDocument()
		);
		expect(within(list).queryByRole('link')).toBeNull();
	});

	it('shows E2 with a coverage action when fewer than two events are upcoming', async () => {
		mockPasses([makePass({ tier_links: [link('1', '2027-02-01T18:00:00Z')] })]);
		renderTab();

		const list = await screen.findByTestId('series-pass-warnings-pass-1');
		await waitFor(() =>
			expect(within(list).getByText('Fewer than two upcoming events')).toBeInTheDocument()
		);
		expect(
			within(list).getByRole('button', { name: 'Change coverage (Season)' })
		).toBeInTheDocument();
	});

	it('shows E4a as a dismissible Info', async () => {
		mockPasses([makePass({ pro_rata_discount: '30.00' })]);
		renderTab();

		const list = await screen.findByTestId('series-pass-warnings-pass-1');
		await waitFor(() =>
			expect(within(list).getByText('Discount can take off the whole price')).toBeInTheDocument()
		);
		expect(within(list).getByRole('button', { name: /Dismiss/ })).toBeInTheDocument();
	});

	it('shows no warning for a healthy pass with the optional props unset', async () => {
		mockPasses([makePass()]);
		renderTab();

		const list = await screen.findByTestId('series-pass-warnings-pass-1');
		expect(within(list).queryByRole('list')).toBeNull();
	});
});
