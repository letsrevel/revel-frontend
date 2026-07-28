import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import TiersTab from './TiersTab.svelte';
import type {
	MembershipTierAdminSchema,
	OrganizationAdminDetailSchema,
	OrganizationMemberSchema,
	OrganizationQuestionnaireInListSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminmembersCreateMembershipTier: vi.fn(),
	organizationadminmembersUpdateMembershipTier: vi.fn(),
	organizationadminmembersDeleteMembershipTier: vi.fn(),
	organizationadminmembersReorderMembershipTiers: vi.fn(),
	// Pulled in by the cascade check here and by the embedded PlansList once
	// `canManageSubscriptions` is on; the factory replaces the whole module, so
	// every transitively imported operation has to be listed.
	organizationadminsubscriptionsListPlans: vi.fn(),
	organizationadminsubscriptionsCreatePlan: vi.fn(),
	organizationadminsubscriptionsUpdatePlan: vi.fn(),
	organizationadminsubscriptionsDeletePlan: vi.fn(),
	organizationadminsubscriptionsArchivePlan: vi.fn(),
	organizationadminsubscriptionsMigratePlanSubscribers: vi.fn()
}));
import {
	organizationadminmembersDeleteMembershipTier,
	organizationadminsubscriptionsListPlans
} from '$lib/api/generated/sdk.gen';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from 'svelte-sonner';

vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));

const organization = { slug: 'test-org' } as unknown as OrganizationAdminDetailSchema;

const tiers = [
	{ id: 'tier-1', name: 'Gold', description: null }
] as unknown as MembershipTierAdminSchema[];

function renderTab(canManageSubscriptions = false) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
	});
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: TiersTab,
			componentProps: {
				organization,
				tiers,
				members: [] as OrganizationMemberSchema[],
				isLoading: false,
				isError: false,
				canManageSubscriptions,
				membershipQuestionnaires: [] as OrganizationQuestionnaireInListSchema[],
				orgDefaultRequiresApproval: false
			}
		}
	});
	// Handed back so cache-invalidation assertions can spy on the very client the
	// component under test is wired to.
	return { client };
}

/** Opens the confirm dialog and presses its destructive button. */
async function confirmDelete(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole('button', { name: 'Delete Gold' }));
	await user.click(await screen.findByRole('button', { name: 'Delete Tier' }));
}

// bits-ui pins pointer-events on <body> while a dialog is open; jsdom keeps
// <body> across tests, so reset it or a test that ends with a dialog open
// poisons every later click.
beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

function arrangePlans(plans: unknown[]) {
	vi.mocked(organizationadminsubscriptionsListPlans).mockResolvedValue({
		data: plans,
		error: undefined,
		response: { ok: true }
	} as never);
}

describe('TiersTab delete cascade warning', () => {
	it('warns that the tier takes its subscription plans down with it', async () => {
		const user = userEvent.setup();
		// A whole plan, not a stub: `canManageSubscriptions` mounts PlansList against
		// this same query, and its price line calls `Intl.NumberFormat` with
		// `style: 'currency'` — a fixture missing `currency`/`price` throws out of
		// the render rather than failing an assertion.
		arrangePlans([
			{
				id: 'plan-1',
				tier_id: 'tier-1',
				tier_name: 'Gold',
				name: 'Monthly',
				description: null,
				price: '10.00',
				currency: 'EUR',
				period_unit: 'month',
				period_count: 1,
				payment_method: 'offline',
				sales_status: 'open',
				is_active: true,
				max_subscriptions: null,
				active_subscription_count: 0
			}
		]);
		renderTab(true);

		await user.click(await screen.findByRole('button', { name: 'Delete Gold' }));

		expect(
			await screen.findByText('Any subscription plans under this tier are deleted with it.')
		).toBeInTheDocument();
	});

	it('omits the cascade warning for a tier with no plans', async () => {
		const user = userEvent.setup();
		arrangePlans([]);
		renderTab(true);

		await user.click(await screen.findByRole('button', { name: 'Delete Gold' }));

		// Anchor on the always-present consequence line so the negative below cannot
		// pass merely because the dialog has not rendered yet.
		await screen.findByText(/will have their tier removed/i);
		await waitFor(() => {
			expect(organizationadminsubscriptionsListPlans).toHaveBeenCalled();
		});
		expect(
			screen.queryByText('Any subscription plans under this tier are deleted with it.')
		).not.toBeInTheDocument();
	});
});

describe('TiersTab delete', () => {
	it('toasts the backend detail verbatim when the delete is refused with a 409', async () => {
		const user = userEvent.setup();
		const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
		vi.mocked(organizationadminmembersDeleteMembershipTier).mockResolvedValue({
			data: undefined,
			error: { detail: 'A membership application still references this tier.' },
			response: { status: 409 }
		} as never);

		renderTab();
		await confirmDelete(user);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				'A membership application still references this tier.'
			);
		});
		// The 409 sentence arrives already translated — a native alert would both
		// bypass the toast surface and block the page.
		expect(alertSpy).not.toHaveBeenCalled();
	});

	it('keeps the confirm dialog open after a refusal so the tier can still be kept', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembersDeleteMembershipTier).mockResolvedValue({
			data: undefined,
			error: { detail: 'A subscription still references this tier.' },
			response: { status: 409 }
		} as never);

		renderTab();
		await confirmDelete(user);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalled();
		});
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('falls back to localized copy when the delete error carries no detail', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembersDeleteMembershipTier).mockResolvedValue({
			data: undefined,
			error: {}
		} as never);

		renderTab();
		await confirmDelete(user);

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith('Could not delete this tier.');
		});
	});

	it('invalidates tiers and members and closes the dialog on a 204', async () => {
		const user = userEvent.setup();
		vi.mocked(organizationadminmembersDeleteMembershipTier).mockResolvedValue({
			data: undefined,
			error: undefined,
			response: { status: 204 }
		} as never);

		const { client } = renderTab();
		const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

		await confirmDelete(user);

		await waitFor(() => {
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ['organization', 'test-org', 'membership-tiers']
			});
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ['organization', 'test-org', 'members']
		});
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		});
		expect(toast.error).not.toHaveBeenCalled();
	});
});
