import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import DiscountCodeForm from './DiscountCodeForm.svelte';
import type { DiscountCodeSchema } from '$lib/api/generated/types.gen';

const { listEvents, listSeries, listTiers } = vi.hoisted(() => ({
	listEvents: vi.fn(),
	listSeries: vi.fn(),
	listTiers: vi.fn()
}));

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicdiscoveryListEvents: listEvents,
	eventseriesListEventSeries: listSeries,
	eventadminticketsListTicketTiers: listTiers
}));

const freeTier = { id: 't-free', name: 'Free', event_id: 'ev-1', payment_method: 'free' };
const paidTier = {
	id: 't-paid',
	name: 'GA',
	event_id: 'ev-1',
	payment_method: 'online',
	price_type: 'fixed',
	currency: 'EUR'
};

function existing(overrides: Partial<DiscountCodeSchema> = {}): DiscountCodeSchema {
	return {
		id: 'dc-1',
		code: 'SUMMER25',
		discount_type: 'percentage',
		discount_value: '20',
		event_ids: ['ev-1'],
		series_ids: [],
		tier_ids: [],
		...overrides
	} as DiscountCodeSchema;
}

function renderForm(existingCode: DiscountCodeSchema | null) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: DiscountCodeForm,
			componentProps: { organizationId: 'org-1', existingCode, onSubmit: vi.fn() }
		}
	});
}

const list = () => screen.queryByTestId('discount-warning-list');

describe('DiscountCodeForm admin warnings (#1314)', () => {
	beforeEach(() => {
		localStorage.clear();
		listEvents.mockReset().mockResolvedValue({
			data: { results: [{ id: 'ev-1', name: 'Summer Party' }] },
			error: undefined
		});
		listSeries.mockReset().mockResolvedValue({
			data: { results: [{ id: 'se-1', name: 'Season' }] },
			error: undefined
		});
		listTiers.mockReset();
	});

	it('warns when only free tiers are in scope (G1a)', async () => {
		listTiers.mockResolvedValue({ data: { results: [freeTier] }, error: undefined });
		renderForm(existing());
		await waitFor(() => expect(list()).toHaveTextContent(/./));
		expect(list()?.querySelectorAll('li')).toHaveLength(1);
		expect(list()).toHaveTextContent('free');
	});

	it('stays silent while the tiers load, and announces nothing', async () => {
		listTiers.mockReturnValue(new Promise(() => undefined));
		renderForm(existing());
		await waitFor(() => expect(listTiers).toHaveBeenCalled());
		expect(list()?.querySelectorAll('li') ?? []).toHaveLength(0);
		expect(list()?.parentElement?.querySelector('[role="status"]')).toHaveTextContent('');
	});

	it('stays silent when a paid tier is in scope', async () => {
		listTiers.mockResolvedValue({ data: { results: [freeTier, paidTier] }, error: undefined });
		renderForm(existing());
		await waitFor(() => expect(listTiers).toHaveBeenCalled());
		await new Promise((r) => setTimeout(r, 50));
		expect(list()?.querySelectorAll('li') ?? []).toHaveLength(0);
	});

	it('stays silent when the tiers of one event failed to load (incomplete scope)', async () => {
		listTiers
			.mockResolvedValueOnce({ data: { results: [freeTier] }, error: undefined })
			.mockResolvedValueOnce({ data: undefined, error: { detail: 'boom' } });
		renderForm(existing({ event_ids: ['ev-1', 'ev-2'] }));
		await waitFor(() => expect(listTiers).toHaveBeenCalledTimes(2));
		await new Promise((r) => setTimeout(r, 50));
		expect(list()?.querySelectorAll('li') ?? []).toHaveLength(0);
	});

	it('stays silent when an event has more tiers than one page', async () => {
		listTiers.mockResolvedValue({
			data: { results: [freeTier], next: 'http://x/?page=2' },
			error: undefined
		});
		renderForm(existing());
		await waitFor(() => expect(listTiers).toHaveBeenCalled());
		await new Promise((r) => setTimeout(r, 50));
		expect(list()?.querySelectorAll('li') ?? []).toHaveLength(0);
	});

	it('stays silent on a cache hit of an incomplete tier scope (remount, no refetch)', async () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false, staleTime: Infinity } }
		});
		const mount = () =>
			render(QueryClientTestWrapper, {
				props: {
					client,
					component: DiscountCodeForm,
					componentProps: {
						organizationId: 'org-1',
						existingCode: existing(),
						onSubmit: vi.fn()
					}
				}
			});
		listTiers.mockResolvedValue({
			data: { results: [freeTier], next: 'http://x/?page=2' },
			error: undefined
		});
		const first = mount();
		await waitFor(() => expect(listTiers).toHaveBeenCalledTimes(1));
		await new Promise((r) => setTimeout(r, 50));
		first.unmount();
		// The second mount reads the cached (incomplete) entry: no refetch, and the
		// incomplete flag must come back with it.
		mount();
		await new Promise((r) => setTimeout(r, 50));
		expect(listTiers).toHaveBeenCalledTimes(1);
		expect(list()?.querySelectorAll('li') ?? []).toHaveLength(0);
	});

	it('stays silent when a series is selected', async () => {
		listTiers.mockResolvedValue({ data: { results: [freeTier] }, error: undefined });
		renderForm(existing({ series_ids: ['se-1'] }));
		await waitFor(() => expect(listTiers).toHaveBeenCalled());
		await new Promise((r) => setTimeout(r, 50));
		expect(list()?.querySelectorAll('li') ?? []).toHaveLength(0);
	});

	it('warns about an unused currency and links to the currency field (G1b)', async () => {
		listTiers.mockResolvedValue({ data: { results: [paidTier] }, error: undefined });
		renderForm(existing({ discount_type: 'fixed_amount', currency: 'USD' }));
		await waitFor(() => expect(list()?.querySelectorAll('li')).toHaveLength(1));
		const fix = screen.getByRole('link', { name: 'Change the currency' });
		expect(fix).toBeInTheDocument();
		expect(document.getElementById('currency')).not.toBeNull();
	});

	it('shows no warning on create until an event with free tiers is selected', async () => {
		listTiers.mockResolvedValue({ data: { results: [freeTier] }, error: undefined });
		renderForm(null);
		await new Promise((r) => setTimeout(r, 50));
		expect(list()?.querySelectorAll('li') ?? []).toHaveLength(0);

		await fireEvent.click(screen.getByRole('button', { name: /events/i }));
		await fireEvent.click(await screen.findByRole('checkbox', { name: /Summer Party/ }));
		await waitFor(() => expect(list()?.querySelectorAll('li')).toHaveLength(1));
		// Create mode: a Warn has no dismiss button.
		expect(screen.queryByRole('button', { name: /^Dismiss:/ })).toBeNull();
	});
});
