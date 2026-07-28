import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import MembersTab from './MembersTab.svelte';
import type {
	MembershipTierSchema,
	OrganizationAdminDetailSchema,
	OrganizationMemberSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembersListMembers: vi.fn(),
	organizationadminmembersRemoveMember: vi.fn(),
	organizationadminmembersUpdateMember: vi.fn(),
	organizationadminmembersAddStaff: vi.fn(),
	organizationadminblacklistCreateBlacklistEntry: vi.fn()
}));
import {
	organizationadminmembersListMembers,
	organizationadminmembersRemoveMember,
	organizationadminblacklistCreateBlacklistEntry
} from '$lib/api/generated/sdk.gen';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from 'svelte-sonner';

vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));

const organization = {
	id: 'org-1',
	slug: 'test-org'
} as unknown as OrganizationAdminDetailSchema;

const member = {
	status: 'active',
	tier: null,
	member_since: '2026-01-01T00:00:00Z',
	subscription: null,
	user: {
		id: 'user-1',
		email: 'ada@example.com',
		first_name: 'Ada',
		last_name: 'Lovelace',
		preferred_name: 'Ada'
	}
} as unknown as OrganizationMemberSchema;

/**
 * The backend's org-scoped, non-terminal subscription row (BE `e37fe2a5`) — its
 * presence on a member is exactly what makes the billing warning truthful.
 *
 * `current_period_end` is pinned to midday UTC so the rendered calendar day is
 * the same in every plausible test timezone.
 */
const activeSubscription = {
	id: 'sub-1',
	plan_id: 'plan-1',
	organization_id: 'org-1',
	status: 'active',
	current_period_end: '2026-12-31T12:00:00Z',
	cancel_at_period_end: false,
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z',
	user_id: 'user-1',
	user_display_name: 'Ada Lovelace',
	user_email: 'ada@example.com',
	plan: {
		id: 'plan-1',
		name: 'Annual',
		tier_id: 'tier-1',
		tier_name: 'Premium',
		price: '99.00',
		currency: 'EUR',
		period_unit: 'year',
		period_count: 1,
		payment_method: 'online',
		sales_status: 'open',
		active_subscription_count: 1
	}
};

/** The same member, but paying. */
const subscribedMember = {
	...member,
	subscription: activeSubscription
} as unknown as OrganizationMemberSchema;

/** A paying member who is currently suspended — the restore-transition fixture. */
const pausedSubscribedMember = {
	...subscribedMember,
	status: 'paused'
} as unknown as OrganizationMemberSchema;

// Whole-string matchers (not regexes) so they resolve to the single <p> that
// carries the notice instead of every ancestor whose textContent contains it.
const PLAN_NOTICE =
	'Their Annual subscription (€99.00 / year) is cancelled immediately and recurring billing stops. No refund is issued automatically.';
const PERIOD_NOTICE = 'The current billing period runs to Dec 31, 2026.';
/** Any cancellation sentence at all — all three variants contain this phrase. */
const ANY_BILLING_SENTENCE = /recurring billing stops/;
const PAUSE_NOTICE = 'No further payments are collected while their membership is paused.';
const PAUSE_SCHEDULED_END_NOTICE =
	'Their subscription is already scheduled to end, so it is not paused — it keeps billing until the current period closes.';
const RESTORE_NOTICE =
	'Restoring membership does not restart billing — subscriptions are resumed separately, from the Subscriptions tab.';

/** The prefix that also covers the metrics query (`[..., 'subscriptions', 'metrics']`). */
const SUBSCRIPTIONS_KEY = ['organization', 'test-org', 'subscriptions'];

function renderTab() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: MembersTab,
			componentProps: {
				organization,
				isOwner: true,
				permissions: null,
				tiers: [] as MembershipTierSchema[],
				staffUserIds: new Set<string>()
			}
		}
	});
	// Handed back so cache-invalidation assertions can spy on the very client the
	// component under test is wired to.
	return { client };
}

/** Opens the manage modal for the seeded member. */
async function openManageModal(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole('button', { name: 'Manage Ada' }));
}

/**
 * bits-ui positions its Select popover with floating-ui, which needs real
 * layout. jsdom never lays out, so `computePosition` never resolves and the
 * popover keeps floating-ui's pre-positioning inline styles — `translate(0,
 * -200%)` and, crucially, `visibility: hidden`. The options *are* in the DOM
 * with `role="option"`, but a visibility-hidden subtree is excluded from the
 * accessibility tree, so `getByRole('option')` finds nothing — and passing
 * `{ hidden: true }` does not save it either, because the same exclusion makes
 * the computed accessible name empty, so the `name` filter never matches.
 *
 * Reveal the popover — exactly what the browser does the moment floating-ui
 * settles — and the options become queryable by role and name, i.e. the way a
 * screen-reader user reaches them. Only then click, so the assertion still runs
 * against the real widget rather than a stand-in.
 */
async function revealOpenSelectPopover() {
	const content = await waitFor(() => {
		const el = document.querySelector('[data-select-content]');
		if (!el) throw new Error('the select popover never opened');
		return el;
	});
	const floatingWrapper = content.parentElement;
	if (floatingWrapper instanceof HTMLElement) {
		floatingWrapper.style.visibility = 'visible';
	}
}

/**
 * Stages a new membership status in the manage modal — click the bits-ui
 * trigger, then the option, exactly as the E2E `pickSelectOption` helper does.
 */
async function pickStatus(user: ReturnType<typeof userEvent.setup>, option: string) {
	await user.click(await screen.findByLabelText('Membership Status'));
	await revealOpenSelectPopover();
	await user.click(await screen.findByRole('option', { name: option }));
}

/** Re-arms the members-list query with a specific set of rows. */
function seedMembers(...rows: OrganizationMemberSchema[]) {
	vi.mocked(organizationadminmembersListMembers).mockResolvedValue({
		data: { results: rows, count: rows.length },
		error: undefined
	} as never);
}

beforeAll(() => {
	// bits-ui 2's Select is written for a real browser: the trigger captures the
	// pointer and the open listbox scrolls its highlighted option into view. jsdom
	// implements neither API, so opening the status dropdown throws without these.
	const noop = (): void => {
		// no-op: jsdom has no layout and no pointer capture
	};
	if (typeof Element.prototype.hasPointerCapture !== 'function') {
		Element.prototype.hasPointerCapture = (): boolean => false;
		Element.prototype.setPointerCapture = noop;
		Element.prototype.releasePointerCapture = noop;
	}
	if (typeof Element.prototype.scrollIntoView !== 'function') {
		Element.prototype.scrollIntoView = noop;
	}
});

beforeEach(() => {
	// bits-ui pins pointer-events on <body> while a dialog is open; jsdom keeps
	// <body> across tests, so reset it or a test that ends with a dialog open
	// poisons every later click.
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
	seedMembers(member);
});

describe('MembersTab membership-loss invalidation', () => {
	// Backend `d4570cf3`: losing membership cancels the member's non-terminal
	// subscription and stops Stripe billing. Without these invalidations the
	// Subscriptions tab and the revenue/MRR metrics keep showing the member as an
	// active payer right after an irreversible, money-moving action.
	it('invalidates the subscription queries after removing a member', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembersRemoveMember).mockResolvedValue({
			data: undefined,
			error: undefined
		} as never);

		const { client } = renderTab();
		const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

		await openManageModal(user);
		await user.click(await screen.findByRole('button', { name: 'Remove from Organization' }));
		await user.click(await screen.findByRole('button', { name: 'Yes, Remove' }));

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SUBSCRIPTIONS_KEY });
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ['organization', 'test-org', 'members']
		});
	});

	it('invalidates the subscription queries after blacklisting a member', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminblacklistCreateBlacklistEntry).mockResolvedValue({
			data: {},
			error: undefined
		} as never);

		const { client } = renderTab();
		const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

		await openManageModal(user);
		await user.click(await screen.findByRole('button', { name: 'Add to Blacklist' }));
		await user.click(await screen.findByRole('button', { name: 'Confirm Blacklist' }));

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: SUBSCRIPTIONS_KEY });
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ['organization', 'test-org', 'blacklist']
		});
	});
});

describe('MembersTab membership-loss billing disclosure', () => {
	// Backend `d4570cf3`: remove / ban / blacklist terminalize the member's
	// non-terminal subscription and stop Stripe billing, with no automatic
	// refund. The confirmation panels have to say so — an organizer must not
	// be able to stop someone's paid membership without being told.
	//
	// Since BE `e37fe2a5` the member row carries that subscription, so the
	// warning is conditional and specific: a paying member gets the plan named,
	// a free member gets no billing sentence at all (the previous unconditional
	// copy warned both identically, which was false for the free one).

	it('names the plan and period in the remove confirmation for a paying member', async () => {
		const user = userEvent.setup();
		seedMembers(subscribedMember);
		renderTab();

		await openManageModal(user);
		await user.click(await screen.findByRole('button', { name: 'Remove from Organization' }));

		expect(await screen.findByText(PLAN_NOTICE)).toBeInTheDocument();
		expect(screen.getByText(PERIOD_NOTICE)).toBeInTheDocument();
	});

	it('names the plan in the blacklist confirmation for a paying member', async () => {
		const user = userEvent.setup();
		seedMembers(subscribedMember);
		renderTab();

		await openManageModal(user);
		await user.click(await screen.findByRole('button', { name: 'Add to Blacklist' }));

		expect(await screen.findByText(PLAN_NOTICE)).toBeInTheDocument();
	});

	it('states the subscription status when it is not active, and drops the period line', async () => {
		const user = userEvent.setup();
		// A paused row is still non-terminal — cancelling it is real — but its
		// stored period end is stale, so only the status is worth showing.
		seedMembers({
			...member,
			subscription: { ...activeSubscription, status: 'paused' }
		} as unknown as OrganizationMemberSchema);
		renderTab();

		await openManageModal(user);
		await user.click(await screen.findByRole('button', { name: 'Remove from Organization' }));

		expect(await screen.findByText(PLAN_NOTICE)).toBeInTheDocument();
		expect(screen.getByText('Current subscription status: Paused.')).toBeInTheDocument();
		expect(screen.queryByText(PERIOD_NOTICE)).not.toBeInTheDocument();
	});

	it('says nothing about billing in the remove confirmation for a free member', async () => {
		const user = userEvent.setup();
		renderTab(); // seeded with the subscription-less member

		await openManageModal(user);
		await user.click(await screen.findByRole('button', { name: 'Remove from Organization' }));

		// The panel is open …
		expect(
			await screen.findByText(
				'This will permanently remove Ada from the organization. This action cannot be undone.'
			)
		).toBeInTheDocument();
		// … and carries no billing claim, because there is no billing to lose.
		expect(screen.queryAllByText(ANY_BILLING_SENTENCE)).toHaveLength(0);
	});

	it('says nothing about billing in the blacklist confirmation for a free member', async () => {
		const user = userEvent.setup();
		renderTab();

		await openManageModal(user);
		await user.click(await screen.findByRole('button', { name: 'Add to Blacklist' }));

		expect(await screen.findByRole('button', { name: 'Confirm Blacklist' })).toBeInTheDocument();
		expect(screen.queryAllByText(ANY_BILLING_SENTENCE)).toHaveLength(0);
	});
});

describe('MembersTab status-change billing disclosure', () => {
	// Backend `d3773257` (`_mirror_status_to_subscriptions`): staff setting a member
	// to CANCELLED now terminalizes their subscription and stops Stripe billing, and
	// PAUSED pauses collection. ACTIVE is deliberately *not* mirrored back. Until
	// then the modal told organizers the opposite ("billing continues"), so these
	// assertions pin the corrected copy to the backend that produces it.

	it('names the plan when cancelling a paying member', async () => {
		const user = userEvent.setup();
		seedMembers(subscribedMember);
		renderTab();

		await openManageModal(user);
		await pickStatus(user, 'Cancelled');

		expect(await screen.findByText(PLAN_NOTICE)).toBeInTheDocument();
		expect(screen.getByText(PERIOD_NOTICE)).toBeInTheDocument();
	});

	it('says nothing about billing when cancelling a free member', async () => {
		const user = userEvent.setup();
		renderTab(); // seeded with the subscription-less member

		await openManageModal(user);
		await pickStatus(user, 'Cancelled');

		// The status explanation is showing …
		expect(
			await screen.findByText(
				'Membership has been cancelled. This is equivalent to not having an active membership.'
			)
		).toBeInTheDocument();
		// … and carries no billing claim, because there is no billing to lose.
		expect(screen.queryAllByText(ANY_BILLING_SENTENCE)).toHaveLength(0);
	});

	it('states that pausing stops collection for a paying member', async () => {
		const user = userEvent.setup();
		seedMembers(subscribedMember);
		renderTab();

		await openManageModal(user);
		await pickStatus(user, 'Paused');

		expect(await screen.findByText(PAUSE_NOTICE)).toBeInTheDocument();
	});

	it('warns that a subscription scheduled to end keeps billing instead of pausing', async () => {
		const user = userEvent.setup();
		// The backend skips the pause for these rows (they stop at the period
		// boundary anyway), so promising "no further payments" would be false.
		seedMembers({
			...member,
			subscription: { ...activeSubscription, cancel_at_period_end: true }
		} as unknown as OrganizationMemberSchema);
		renderTab();

		await openManageModal(user);
		await pickStatus(user, 'Paused');

		expect(await screen.findByText(PAUSE_SCHEDULED_END_NOTICE)).toBeInTheDocument();
		expect(screen.queryByText(PAUSE_NOTICE)).not.toBeInTheDocument();
	});

	it('says nothing about billing when pausing a free member', async () => {
		const user = userEvent.setup();
		renderTab();

		await openManageModal(user);
		await pickStatus(user, 'Paused');

		expect(
			await screen.findByText('Members can view events but cannot participate or RSVP.')
		).toBeInTheDocument();
		expect(screen.queryByText(PAUSE_NOTICE)).not.toBeInTheDocument();
		expect(screen.queryByText(PAUSE_SCHEDULED_END_NOTICE)).not.toBeInTheDocument();
	});

	it('warns that restoring a member does not restart their billing', async () => {
		const user = userEvent.setup();
		seedMembers(pausedSubscribedMember);
		renderTab();

		await openManageModal(user);
		await pickStatus(user, 'Active');

		expect(await screen.findByText(RESTORE_NOTICE)).toBeInTheDocument();
	});

	it('warns only about the staged change, not the status already in force', async () => {
		const user = userEvent.setup();
		seedMembers(pausedSubscribedMember);
		renderTab();

		// Opening on an already-paused member stages nothing, so neither the pause
		// nor the restore sentence applies.
		await openManageModal(user);

		expect(
			await screen.findByText('Members can view events but cannot participate or RSVP.')
		).toBeInTheDocument();
		expect(screen.queryByText(PAUSE_NOTICE)).not.toBeInTheDocument();
		expect(screen.queryByText(RESTORE_NOTICE)).not.toBeInTheDocument();
	});
});

describe('MembersTab failure surfacing', () => {
	it('toasts the backend refusal instead of blocking the page with a native alert', async () => {
		const user = userEvent.setup();
		const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
		vi.mocked(organizationadminmembersRemoveMember).mockResolvedValue({
			data: undefined,
			error: { detail: 'This member still has an active subscription.' },
			response: { status: 409 }
		} as never);

		renderTab();

		await openManageModal(user);
		await user.click(await screen.findByRole('button', { name: 'Remove from Organization' }));
		await user.click(await screen.findByRole('button', { name: 'Yes, Remove' }));

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				'Failed to remove member: This member still has an active subscription.'
			);
		});
		expect(alertSpy).not.toHaveBeenCalled();
	});
});
