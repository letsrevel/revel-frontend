import { render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import Page from './+page.svelte';

vi.mock('$app/stores', async () => {
	const { readable } = await import('svelte/store');
	return {
		page: readable({
			url: new URL('http://localhost/org/acme/admin/events/e1/waitlist'),
			data: { organization: { id: 'o1', slug: 'acme', name: 'Acme' } }
		})
	};
});
vi.mock('$app/paths', () => ({
	resolve: (route: string, params?: Record<string, string>) =>
		route.replace(/\[(\w+)\]/g, (_, k: string) => params?.[k] ?? ''),
	base: ''
}));
vi.mock('$lib/api', () => ({
	eventadminwaitlistListWaitlist: vi.fn(),
	eventadminwaitlistDeleteWaitlistEntry: vi.fn()
}));
vi.mock('$lib/api/queries/waitlist-offers', () => ({
	createWaitlistSettingsQueryOptions: () => () => ({
		queryKey: ['settings'],
		queryFn: () => {
			settingsCalls += 1;
			return settingsPromise;
		}
	}),
	createWaitlistOffersQueryOptions: () => () => ({
		queryKey: ['offers'],
		queryFn: async () => ({ results: [], count: 0 })
	}),
	createCreateWaitlistOfferMutationOptions: () => () => ({ mutationFn: async () => ({}) }),
	createRevokeWaitlistOfferMutationOptions: () => () => ({ mutationFn: async () => ({}) }),
	createReactivateWaitlistOfferMutationOptions: () => () => ({ mutationFn: async () => ({}) })
}));
vi.mock('$lib/components/events/waitlist/admin/WaitlistSettingsCard.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/events/waitlist/admin/WaitlistEntriesTable.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/events/waitlist/admin/WaitlistOffersTable.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('$lib/components/events/waitlist/admin/OfferExpiryDialog.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));

let settingsPromise: Promise<unknown>;
let settingsCalls = 0;
const openSettings = {
	waitlist_open: true,
	waitlist_time_window: null,
	waitlist_batch_size: 1,
	waitlist_cutoff_date: null,
	waitlist_lottery_mode: false
};

function setup(eventCapacity: unknown) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: Page,
			componentProps: {
				data: {
					eventId: 'e1',
					waitlistData: { results: [], count: 0 },
					eventCapacity
				}
			}
		}
	});
}

describe('waitlist page C1 warning', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		settingsCalls = 0;
	});

	it('warns, with a link to the edit page, when the waitlist is open and the event has no capacity', async () => {
		settingsPromise = Promise.resolve(openSettings);
		setup({ max_attendees: null, waitlist_open: true, venueCapacity: null });
		const list = await screen.findByTestId('waitlist-warnings');
		await waitFor(() => expect(list.querySelector('[data-warning-id="C1"]')).not.toBeNull());
		expect(screen.getByRole('link', { name: 'Set attendee limit' })).toHaveAttribute(
			'href',
			'/(auth)/org/acme/admin/events/e1/edit'
		);
	});

	it('shows no callout and no announcement while the waitlist settings load', async () => {
		settingsPromise = new Promise(() => undefined);
		setup({ max_attendees: null, waitlist_open: true, venueCapacity: null });
		const list = await screen.findByTestId('waitlist-warnings');
		expect(list.querySelector('[data-warning-id="C1"]')).toBeNull();
		expect(screen.getByTestId('waitlist-warnings-announcer')).toHaveTextContent('');
	});

	it('shows nothing when the event has a capacity', async () => {
		settingsPromise = Promise.resolve(openSettings);
		setup({ max_attendees: 50, waitlist_open: true, venueCapacity: null });
		await screen.findByTestId('waitlist-warnings');
		// Let the settings query resolve and the page re-render before asserting absence.
		await waitFor(() => expect(settingsCalls).toBeGreaterThan(0));
		await settingsPromise;
		await tick();
		await new Promise((r) => setTimeout(r, 20));
		expect(document.querySelector('[data-warning-id="C1"]')).toBeNull();
	});
});
