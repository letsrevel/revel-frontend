import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { OrganizationAdminDetailSchema } from '$lib/api/generated/types.gen';

const api = vi.hoisted(() => ({
	listPeople: vi.fn(),
	listPersonPeriods: vi.fn(),
	countRegister: vi.fn(),
	listPossibleDuplicates: vi.fn()
}));
vi.mock('$lib/member-register/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/member-register/api')>()),
	...api
}));

const tiers = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('$lib/queries/membership-tiers', () => ({
	allTiersQueryOptions: (slug: string) => ({
		queryKey: ['organization', slug, 'tiers-all'],
		queryFn: tiers.fetch
	})
}));

const requests = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('$lib/queries/membership-requests', () => ({
	pendingApplicationsQueryOptions: (slug: string) => ({
		queryKey: ['organization', slug, 'membership-requests', 'pending', 1],
		queryFn: requests.fetch
	})
}));

const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('$app/stores', async () => {
	const { readable } = await import('svelte/store');
	return {
		page: {
			subscribe: (run: (value: { url: URL }) => void) =>
				readable({
					url: new URL(`http://localhost/org/acme/admin/members${nav.search}`)
				}).subscribe(run)
		}
	};
});
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembersListMembers: vi.fn().mockResolvedValue({ data: { results: [] } }),
	organizationadminusernotesGetRecordNote: vi
		.fn()
		.mockResolvedValue({ error: { detail: 'nf' }, response: { status: 404 } })
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));

import PeopleTab from './PeopleTab.svelte';
import { makeRecord } from '../member-register/person-fixtures';

const organization = {
	slug: 'acme',
	timezone: 'Europe/Rome'
} as unknown as OrganizationAdminDetailSchema;

function renderTab(active: boolean) {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: PeopleTab as never,
			componentProps: {
				organization,
				isOwner: true,
				active,
				onOpenApplications: vi.fn(),
				onCreateInviteLink: vi.fn(),
				staffUserIds: new Set<string>()
			}
		}
	});
}

const emptyPage = { count: 0, next: null, previous: null, results: [] };

beforeEach(() => {
	nav.search = '?tab=people';
	api.listPeople.mockReset().mockResolvedValue(emptyPage);
	api.listPersonPeriods
		.mockReset()
		.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
	api.countRegister.mockReset().mockResolvedValue(0);
	api.listPossibleDuplicates.mockReset().mockResolvedValue([]);
	tiers.fetch.mockReset().mockResolvedValue([]);
	requests.fetch.mockReset().mockResolvedValue({ count: 0, results: [] });
});
afterEach(() => {
	document.body.style.pointerEvents = '';
});

describe('PeopleTab while another tab is showing', () => {
	it('fires no query: no register list, count, duplicates scan, applications or tiers', async () => {
		renderTab(false);
		// Give a would-be fetch time to start.
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(api.listPeople).not.toHaveBeenCalled();
		expect(api.countRegister).not.toHaveBeenCalled();
		expect(api.listPossibleDuplicates).not.toHaveBeenCalled();
		expect(requests.fetch).not.toHaveBeenCalled();
		expect(tiers.fetch).not.toHaveBeenCalled();
	});

	it('runs every query once it is the active tab', async () => {
		renderTab(true);
		await waitFor(() => expect(api.listPeople).toHaveBeenCalled());
		await waitFor(() => expect(api.listPossibleDuplicates).toHaveBeenCalled());
		expect(api.countRegister).toHaveBeenCalled();
		expect(requests.fetch).toHaveBeenCalled();
		expect(tiers.fetch).toHaveBeenCalled();
	});
});

describe('PeopleTab chips and queries', () => {
	it('asks for today (org timezone) + standard on the default "Current" chip', async () => {
		renderTab(true);
		await waitFor(() => expect(api.listPeople).toHaveBeenCalled());
		const query = api.listPeople.mock.calls[0][2];
		expect(query).toMatchObject({ kind: 'standard', page: 1 });
		expect(query.active_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(query).not.toHaveProperty('is_open');
	});

	it('drops every chip filter in "As of" mode and says so instead of showing chips', async () => {
		nav.search = '?tab=people&view=ended&on=2026-03-12';
		renderTab(true);
		await waitFor(() => expect(api.listPeople).toHaveBeenCalled());
		expect(api.listPeople.mock.calls[0][2]).toEqual({
			page: 1,
			page_size: 20,
			active_on: '2026-03-12'
		});
		expect(screen.queryByTestId('people-chips')).not.toBeInTheDocument();
		expect(await screen.findByTestId('people-as-of-note')).toHaveTextContent(
			/showing everyone who was a member on/i
		);
	});
});

describe('PeopleTab Ended chip', () => {
	it('sends the real ended=true filter, with no is_open and no client-side narrowing', async () => {
		nav.search = '?tab=people&view=ended';
		renderTab(true);
		await waitFor(() => expect(api.listPeople).toHaveBeenCalled());
		const query = api.listPeople.mock.calls[0][2];
		expect(query).toMatchObject({ ended: true, page: 1 });
		expect(query).not.toHaveProperty('is_open');
		expect(query).not.toHaveProperty('active_on');
	});
});

describe('PeopleTab person sheet', () => {
	const row = makeRecord();
	const rowPage = { count: 1, next: null, previous: null, results: [row] };

	it('opens from the row button, names itself after the person, and gives focus back on close', async () => {
		api.listPeople.mockResolvedValue(rowPage);
		renderTab(true);
		const opener = await screen.findAllByRole('button', { name: 'Open Ada Rossi' });
		opener[0].focus();
		await userEvent.keyboard('{Enter}');

		const dialog = await screen.findByRole('dialog', { name: 'Ada Rossi' });
		// Focus moved into the sheet.
		await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
		// The periods are requested for the person, merged entries included.
		await waitFor(() => expect(api.listPersonPeriods).toHaveBeenCalledWith('acme', 'tok', 'u1'));

		await userEvent.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		await waitFor(() => expect(document.activeElement).toBe(opener[0]));
	});
});

describe('PeopleTab empty states', () => {
	it('a brand-new org sees "No register entries yet" on the default chip, and Invite all is disabled', async () => {
		renderTab(true);
		expect(await screen.findByText('No register entries yet')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Add to register' })).toBeInTheDocument();
		expect(screen.queryByText('No entries match these filters')).not.toBeInTheDocument();

		screen.getByTestId('people-more').focus();
		await (await import('@testing-library/user-event')).default.keyboard('{Enter}');
		const inviteAll = await screen.findByTestId('invite-all-open');
		expect(inviteAll).toHaveAttribute('data-disabled');
	});

	it('an empty chip on a register that has entries is a filtered empty state, not "no entries"', async () => {
		api.countRegister.mockResolvedValue(7);
		renderTab(true);
		expect(await screen.findByText('No entries match these filters')).toBeInTheDocument();
		expect(screen.queryByText('No register entries yet')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Show everyone' })).toBeInTheDocument();
	});
});
