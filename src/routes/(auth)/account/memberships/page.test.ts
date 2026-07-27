import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import Page from './+page.svelte';
import type { MyMembershipSchema, MySubscriptionSchema } from '$lib/api/generated/types.gen';

const listMembershipsMock = vi.hoisted(() => vi.fn());
const listSubscriptionsMock = vi.hoisted(() => vi.fn());
const listApplicationsMock = vi.hoisted(() => vi.fn());
const getApplicationMock = vi.hoisted(() => vi.fn());
// The factory replaces the whole module, so every operation the page tree
// imports — including the ones it only reaches transitively through the cards,
// their dialogs and the application rows — has to exist here or the import
// itself throws.
vi.mock('$lib/api/generated/sdk.gen', () => ({
	mesubscriptionsListMyMemberships: listMembershipsMock,
	mesubscriptionsListMySubscriptions: listSubscriptionsMock,
	memembershipapplicationsListApplications: listApplicationsMock,
	memembershipapplicationsGetApplication: getApplicationMock,
	mesubscriptionsCreateBillingPortalSession: vi.fn(),
	mesubscriptionsCancelSubscription: vi.fn(),
	mesubscriptionsChangePlan: vi.fn(),
	mesubscriptionsReviveSubscription: vi.fn(),
	mesubscriptionsGetMySubscription: vi.fn(),
	organizationListMembershipPlans: vi.fn(),
	organizationGetOrganization: vi.fn(),
	memembershipapplicationsCancel: vi.fn(),
	memembershipapplicationsApply: vi.fn()
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'tok' } }));
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

// The revival window is evaluated against the wall clock, so the fixtures are
// anchored to "now" rather than to a frozen literal date.
const DAY = 24 * 60 * 60 * 1000;
const IN_WINDOW = new Date(Date.now() + 30 * DAY).toISOString();
const LAPSED = new Date(Date.now() - DAY).toISOString();

function makeSub(overrides: Partial<MySubscriptionSchema> = {}): MySubscriptionSchema {
	return {
		id: 'sub-1',
		plan_id: 'plan-1',
		organization_id: 'org-1',
		organization_name: 'Acme',
		organization_slug: 'acme',
		organization_logo_url: null,
		status: 'expired',
		current_period_start: '2026-06-01T00:00:00Z',
		current_period_end: '2026-07-01T00:00:00Z',
		cancelled_at: null,
		pending_plan_id: null,
		expired_at: '2026-07-01T00:00:00Z',
		revival_deadline: IN_WINDOW,
		grace_deadline: null,
		cancel_at_period_end: false,
		created_at: '2026-06-01T00:00:00Z',
		updated_at: '2026-07-01T00:00:00Z',
		plan: {
			id: 'plan-1',
			tier_id: 'tier-1',
			tier_name: 'Gold',
			name: 'Monthly',
			description: null,
			price: '10.00',
			currency: 'EUR',
			period_unit: 'month',
			period_count: 1,
			payment_method: 'online',
			sales_status: 'open',
			is_active: true
		},
		...overrides
	};
}

function makeMembership(overrides: Partial<MyMembershipSchema> = {}): MyMembershipSchema {
	return {
		organization_id: 'org-1',
		organization_name: 'Acme',
		organization_slug: 'acme',
		organization_logo_url: null,
		member_since: '2026-06-01T00:00:00Z',
		status: 'cancelled',
		tier: null,
		subscription: null,
		...overrides
	};
}

function page<T>(results: T[]) {
	return { data: { count: results.length, next: null, previous: null, results }, error: undefined };
}

describe('Account memberships page', () => {
	let queryClient: QueryClient;

	function renderPage() {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: Page, componentProps: {} }
		});
	}

	/** Both list queries answered; applications empty unless a test says otherwise. */
	function mockLists(memberships: MyMembershipSchema[], subscriptions: MySubscriptionSchema[]) {
		listMembershipsMock.mockResolvedValue(page(memberships));
		listSubscriptionsMock.mockResolvedValue(page(subscriptions));
	}

	/** The h1/h2 outline, ignoring the h3s the cards and groups emit. */
	function outline(): string[] {
		return screen
			.getAllByRole('heading')
			.filter((h) => h.tagName === 'H1' || h.tagName === 'H2')
			.map((h) => `${h.tagName}:${h.textContent?.trim()}`);
	}

	function rejoinOffers() {
		return screen.queryAllByRole('heading', { level: 3, name: /has expired/i });
	}

	beforeEach(() => {
		listMembershipsMock.mockReset();
		listSubscriptionsMock.mockReset();
		listApplicationsMock.mockReset().mockResolvedValue(page([]));
		// Rows advance themselves on read; keep that inert so it never interferes.
		getApplicationMock.mockReset().mockImplementation(
			() =>
				new Promise(() => {
					/* never settles */
				})
		);
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	describe('page shell', () => {
		it('nests both sections under the page heading, in order', async () => {
			mockLists([], []);
			renderPage();

			await screen.findByText(/don't have any active memberships/i);
			expect(outline()).toEqual(['H1:My Memberships', 'H2:Memberships', 'H2:Applications']);
		});

		it('renders both sections when every query comes back empty', async () => {
			mockLists([], []);
			renderPage();

			expect(await screen.findByText(/don't have any active memberships/i)).toBeInTheDocument();
			expect(await screen.findByText(/no applications yet/i)).toBeInTheDocument();
		});

		it('keeps the applications section mounted while the memberships lists are in flight', async () => {
			// Applications carry state-advancing reads, so the section must never be
			// gated behind the memberships queries — it has to mount on first paint.
			listMembershipsMock.mockImplementation(
				() =>
					new Promise(() => {
						/* never settles */
					})
			);
			listSubscriptionsMock.mockImplementation(
				() =>
					new Promise(() => {
						/* never settles */
					})
			);
			renderPage();

			expect(await screen.findByText(/no applications yet/i)).toBeInTheDocument();
			expect(screen.getByRole('heading', { level: 2, name: 'Applications' })).toBeVisible();
			// The memberships half is still loading, so it must not have decided it is empty.
			expect(screen.queryByText(/don't have any active memberships/i)).toBeNull();
		});
	});

	describe('rejoin selection', () => {
		it('offers a rejoin for an expired online subscription still inside its window', async () => {
			mockLists([], [makeSub()]);
			renderPage();

			expect(
				await screen.findByRole('heading', { level: 3, name: /membership at acme has expired/i })
			).toBeInTheDocument();
			// A rejoin offer is content: the empty state must stand down for it.
			expect(screen.queryByText(/don't have any active memberships/i)).toBeNull();
		});

		it('drops a subscription whose revival deadline has passed', async () => {
			mockLists([], [makeSub({ revival_deadline: LAPSED })]);
			renderPage();

			expect(await screen.findByText(/don't have any active memberships/i)).toBeInTheDocument();
			expect(rejoinOffers()).toHaveLength(0);
		});

		it('drops an offline subscription — reviving it is the organization’s job', async () => {
			const sub = makeSub();
			mockLists([], [{ ...sub, plan: { ...sub.plan, payment_method: 'offline' } }]);
			renderPage();

			expect(await screen.findByText(/don't have any active memberships/i)).toBeInTheDocument();
			expect(rejoinOffers()).toHaveLength(0);
		});

		it('drops an org the member has already rejoined', async () => {
			const live = makeSub({ id: 'sub-live', status: 'active', revival_deadline: null });
			mockLists([makeMembership({ status: 'active', subscription: live })], [makeSub()]);
			renderPage();

			const card = await screen.findByRole('article', { name: 'Acme' });
			expect(within(card).getByRole('heading', { level: 3, name: 'Acme' })).toBeInTheDocument();
			expect(rejoinOffers()).toHaveLength(0);
		});

		it('offers one card for the newest of several expired subscriptions in one org', async () => {
			// The list arrives `-created_at`, so the first row for an org is its newest.
			mockLists(
				[],
				[
					makeSub({
						id: 'sub-new',
						created_at: '2026-06-01T00:00:00Z',
						plan: { ...makeSub().plan, id: 'plan-2', name: 'Yearly' }
					}),
					makeSub({ id: 'sub-old', created_at: '2025-06-01T00:00:00Z' })
				]
			);
			renderPage();

			await screen.findByRole('heading', { level: 3, name: /membership at acme has expired/i });
			expect(rejoinOffers()).toHaveLength(1);
			expect(screen.getByText(/Yearly ·/)).toBeInTheDocument();
			expect(screen.queryByText(/Monthly ·/)).toBeNull();
		});

		it('replaces the surviving cancelled card with the rejoin offer', async () => {
			// Expiry does not delete the member row: the backend maps EXPIRED onto a
			// bare `cancelled` membership. Rendering both would show the same org twice.
			mockLists([makeMembership({ status: 'cancelled', subscription: null })], [makeSub()]);
			renderPage();

			await screen.findByRole('heading', { level: 3, name: /membership at acme has expired/i });
			expect(screen.getAllByRole('article', { name: 'Acme' })).toHaveLength(1);
			expect(screen.queryByText(/member since/i)).toBeNull();
		});

		it('withholds the offer from a paused member', async () => {
			mockLists([makeMembership({ status: 'paused' })], [makeSub()]);
			renderPage();

			await screen.findByRole('article', { name: 'Acme' });
			expect(rejoinOffers()).toHaveLength(0);
		});

		it('withholds the offer from a banned member', async () => {
			mockLists([makeMembership({ status: 'banned' })], [makeSub()]);
			renderPage();

			await screen.findByRole('article', { name: 'Acme' });
			expect(rejoinOffers()).toHaveLength(0);
		});

		it('withholds the offer when the cancelled row still carries a subscription', async () => {
			// Only non-terminal subscriptions are inlined, so an inlined one means the
			// member already has a live subscription with this org.
			const inlined = makeSub({ id: 'sub-live', status: 'active', revival_deadline: null });
			mockLists([makeMembership({ status: 'cancelled', subscription: inlined })], [makeSub()]);
			renderPage();

			await screen.findByRole('article', { name: 'Acme' });
			expect(rejoinOffers()).toHaveLength(0);
		});
	});
});
