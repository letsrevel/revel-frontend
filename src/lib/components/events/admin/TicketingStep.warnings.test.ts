import { render, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import TicketingStep from './TicketingStep.svelte';

const hoisted = vi.hoisted(() => ({
	tiers: vi.fn(),
	event: vi.fn()
}));

vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventadminticketsListTicketTiers: hoisted.tiers,
	eventadminticketsReorderTicketTiers: vi.fn(),
	eventadminticketsUpdateTicketTier: vi.fn(),
	eventpublicdetailsGetEvent: hoisted.event,
	organizationadminmembersListMembershipTiers: vi.fn(async () => ({ data: [], error: undefined }))
}));

const FUTURE = '2099-01-01T10:00:00Z';
const FUTURE_END = '2099-01-01T20:00:00Z';

function renderStep() {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(QueryClientTestWrapper, {
		props: {
			client,
			component: TicketingStep,
			componentProps: {
				eventId: 'event-1',
				organizationSlug: 'org',
				organizationStripeConnected: false,
				formData: {},
				onUpdate: vi.fn(),
				onBack: vi.fn(),
				onNext: vi.fn()
			}
		}
	});
}

const c4 = () => document.querySelector('[data-warning-id="C4"]');

describe('TicketingStep admin warnings', () => {
	it('C4: warns when the saved event is open and no tier is on sale', async () => {
		hoisted.tiers.mockResolvedValue({
			data: { results: [{ id: 't1', name: 'GA', sales_paused: true }] },
			error: undefined
		});
		hoisted.event.mockResolvedValue({
			data: {
				compliance: null,
				status: 'open',
				requires_ticket: true,
				start: FUTURE,
				end: FUTURE_END
			},
			error: undefined
		});
		renderStep();
		await waitFor(() => expect(c4()).not.toBeNull());
		expect(c4()).toHaveTextContent('No tickets are on sale');
	});

	it('C4: no warning while the queries are still loading', async () => {
		hoisted.tiers.mockReturnValue(new Promise(() => undefined));
		hoisted.event.mockReturnValue(new Promise(() => undefined));
		renderStep();
		await new Promise((r) => setTimeout(r, 30));
		expect(c4()).toBeNull();
	});

	it('C4: no warning while only the tiers have loaded', async () => {
		hoisted.tiers.mockResolvedValue({ data: { results: [] }, error: undefined });
		hoisted.event.mockReturnValue(new Promise(() => undefined));
		renderStep();
		await new Promise((r) => setTimeout(r, 30));
		expect(c4()).toBeNull();
	});
	const eventData = (status: string) => ({
		data: {
			compliance: null,
			status,
			requires_ticket: true,
			start: FUTURE,
			end: FUTURE_END
		},
		error: undefined
	});

	// Waits until both queries resolved (the tier name is rendered), then lets the derived settle.
	async function settled(name: string) {
		const view = renderStep();
		await waitFor(() => expect(view.getAllByText(name).length).toBeGreaterThan(0));
		await new Promise((r) => setTimeout(r, 30));
	}

	it('C4: no warning when a tier is on sale', async () => {
		hoisted.tiers.mockResolvedValue({
			data: { results: [{ id: 't1', name: 'OnSaleTier', sales_paused: false }] },
			error: undefined
		});
		hoisted.event.mockResolvedValue(eventData('open'));
		await settled('OnSaleTier');
		expect(c4()).toBeNull();
	});

	it('C4: no warning for a draft event even if every tier is paused', async () => {
		hoisted.tiers.mockResolvedValue({
			data: { results: [{ id: 't1', name: 'PausedDraftTier', sales_paused: true }] },
			error: undefined
		});
		hoisted.event.mockResolvedValue(eventData('draft'));
		await settled('PausedDraftTier');
		expect(c4()).toBeNull();
	});

	it('C4: no warning when the tiers list has a next page', async () => {
		hoisted.tiers.mockResolvedValue({
			data: {
				count: 25,
				next: 'http://x/?page=2',
				results: [{ id: 't1', name: 'PagedTier', sales_paused: true }]
			},
			error: undefined
		});
		hoisted.event.mockResolvedValue(eventData('open'));
		await settled('PagedTier');
		expect(c4()).toBeNull();
	});
});
