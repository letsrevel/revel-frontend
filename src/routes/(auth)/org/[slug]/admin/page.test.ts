import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { readable } from 'svelte/store';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import Page from './+page.svelte';

const { organization } = vi.hoisted(() => ({
	organization: {
		id: 'org-1',
		slug: 'acme',
		name: 'Acme',
		visibility: 'private',
		contact_email: 'a@b.c'
	}
}));

vi.mock('$app/stores', () => ({
	page: readable({ data: { organization } })
}));
vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	invalidateAll: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembersListMembershipTiers: vi.fn().mockResolvedValue({ data: [] }),
	organizationadmincoreUpdateOrganization: vi.fn()
}));
vi.mock('$lib/utils/org-setup-progress', async (orig) => {
	const actual = await orig<typeof import('$lib/utils/org-setup-progress')>();
	return { ...actual, billingNeedsAttention: () => false };
});

function setup(setupCounts: unknown, setupHidden = false) {
	return render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: Page,
			componentProps: {
				data: {
					canCreateEvent: true,
					isOwner: true,
					isStaff: true,
					dashboardEvents: [],
					draftCount: 0,
					pendingRequestCount: 0,
					setupCounts,
					setupHidden
				}
			}
		}
	});
}

const createButtons = () => screen.queryAllByRole('button', { name: /Create Event/i });
const nextUp = () => document.querySelector('section[aria-label="Next event"]');

describe('org admin dashboard: setup card vs empty next-event panel', () => {
	it('omits the empty NextEventPanel while the setup card shows with no event', () => {
		setup({ eventCount: 0, publishedCount: 0, latestDraft: null });
		expect(screen.getByTestId('org-setup-card')).toBeTruthy();
		expect(nextUp()).toBeNull();
		// Header button remains.
		expect(createButtons().length).toBeGreaterThanOrEqual(1);
	});

	it('shows the panel again once the user hides the card', async () => {
		const user = userEvent.setup();
		setup({ eventCount: 0, publishedCount: 0, latestDraft: null });
		expect(nextUp()).toBeNull();
		await user.click(screen.getByRole('button', { name: /hide/i }));
		expect(screen.queryByTestId('org-setup-card')).toBeNull();
		expect(nextUp()).not.toBeNull();
	});

	it('keeps the panel when an event already exists', () => {
		setup({ eventCount: 1, publishedCount: 0, latestDraft: { id: 'e1', name: 'Draft' } });
		expect(screen.getByTestId('org-setup-card')).toBeTruthy();
		expect(nextUp()).not.toBeNull();
	});
});

describe('org admin dashboard: server-hidden setup card', () => {
	const baseData = {
		canCreateEvent: true,
		isOwner: true,
		isStaff: true,
		dashboardEvents: [],
		draftCount: 0,
		pendingRequestCount: 0
	};

	it('renders the collapsed line straight from data.setupHidden (no counts)', () => {
		setup(null, true);
		expect(screen.queryByTestId('org-setup-card')).toBeNull();
		expect(screen.getByText('Setup hidden.')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Show it again' })).toBeTruthy();
		// Hidden card: the empty next-event panel is back.
		expect(nextUp()).not.toBeNull();
	});

	it('follows data.setupHidden across a client-side org switch', async () => {
		const user = userEvent.setup();
		const { rerender } = setup({ eventCount: 0, publishedCount: 0, latestDraft: null });
		await user.click(screen.getByRole('button', { name: /hide/i }));
		expect(screen.queryByTestId('org-setup-card')).toBeNull();

		// Switch to an org whose card is visible: the local "hidden" must not leak over.
		await rerender({
			componentProps: {
				data: {
					...baseData,
					setupCounts: { eventCount: 0, publishedCount: 0, latestDraft: null },
					setupHidden: false
				}
			}
		});
		expect(screen.getByTestId('org-setup-card')).toBeTruthy();

		// ... and to one hidden by its cookie.
		await rerender({
			componentProps: { data: { ...baseData, setupCounts: null, setupHidden: true } }
		});
		expect(screen.queryByTestId('org-setup-card')).toBeNull();
		expect(screen.getByText('Setup hidden.')).toBeTruthy();
	});
});
