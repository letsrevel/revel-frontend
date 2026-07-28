import { render, screen, waitFor, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import PlansList from './PlansList.svelte';
import type {
	MembershipTierSchema,
	OrganizationAdminDetailSchema,
	PlanSchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsListPlans: vi.fn(),
	organizationadminsubscriptionsCreatePlan: vi.fn(),
	organizationadminsubscriptionsUpdatePlan: vi.fn(),
	organizationadminsubscriptionsDeletePlan: vi.fn(),
	organizationadminsubscriptionsArchivePlan: vi.fn(),
	// Imported by MigrateSubscribersDialog, which this list renders lazily — the
	// mock factory replaces the whole module, so every transitively imported
	// operation has to be present or the import binding blows up.
	organizationadminsubscriptionsMigratePlanSubscribers: vi.fn()
}));
import {
	organizationadminsubscriptionsListPlans,
	organizationadminsubscriptionsDeletePlan,
	organizationadminsubscriptionsArchivePlan
} from '$lib/api/generated/sdk.gen';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));

const organization = {
	slug: 'test-org',
	is_stripe_connected: false
} as unknown as OrganizationAdminDetailSchema;

const tier = { id: 'tier-1', name: 'Gold' } as unknown as MembershipTierSchema;

function makePlan(overrides: Partial<PlanSchema> = {}): PlanSchema {
	return {
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
		active_subscription_count: 0,
		...overrides
	} as PlanSchema;
}

function arrangePlans(plans: PlanSchema[]) {
	vi.mocked(organizationadminsubscriptionsListPlans).mockResolvedValue({
		data: plans,
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof organizationadminsubscriptionsListPlans>>);
}

function renderList() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } }
	});
	return render(QueryClientTestWrapper, {
		props: { client, component: PlansList, componentProps: { organization, tier } }
	});
}

// bits-ui pins pointer-events on <body> while a dialog is open; jsdom keeps
// <body> across tests, so reset it or a test that ends with a dialog open
// poisons every later click.
beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

describe('PlansList archive confirmation', () => {
	it('confirms before archiving instead of firing on the icon click', async () => {
		const user = userEvent.setup();
		arrangePlans([makePlan()]);
		renderList();

		await user.click(await screen.findByRole('button', { name: 'Archive' }));

		expect(await screen.findByRole('dialog', { name: 'Archive Monthly?' })).toBeInTheDocument();
		expect(screen.getByText(/revivals into this plan stop/i)).toBeInTheDocument();
		expect(organizationadminsubscriptionsArchivePlan).not.toHaveBeenCalled();
	});

	it('archives once the confirmation CTA is pressed', async () => {
		const user = userEvent.setup();
		arrangePlans([makePlan()]);
		vi.mocked(organizationadminsubscriptionsArchivePlan).mockResolvedValue({
			data: makePlan({ is_active: false }),
			error: undefined,
			response: { ok: true } as unknown as Response
		} as unknown as Awaited<ReturnType<typeof organizationadminsubscriptionsArchivePlan>>);
		renderList();

		await user.click(await screen.findByRole('button', { name: 'Archive' }));
		await user.click(await screen.findByRole('button', { name: 'Archive plan' }));

		await waitFor(() => {
			expect(organizationadminsubscriptionsArchivePlan).toHaveBeenCalledTimes(1);
		});
	});
});

describe('PlansList delete confirmation', () => {
	it('confirms before deleting instead of firing on the icon click', async () => {
		const user = userEvent.setup();
		arrangePlans([makePlan()]);
		renderList();

		await user.click(await screen.findByRole('button', { name: 'Delete plan' }));

		expect(await screen.findByRole('dialog', { name: 'Delete plan' })).toBeInTheDocument();
		expect(screen.getByText('Delete "Monthly"?')).toBeInTheDocument();
		expect(organizationadminsubscriptionsDeletePlan).not.toHaveBeenCalled();
	});

	it('offers "Archive instead" when the backend refuses with the in-use 400', async () => {
		const user = userEvent.setup();
		arrangePlans([makePlan()]);
		vi.mocked(organizationadminsubscriptionsDeletePlan).mockResolvedValue({
			data: undefined,
			error: { detail: 'Cannot delete a plan with existing subscriptions. Archive it instead.' },
			response: { status: 400 }
		} as never);
		renderList();

		await user.click(await screen.findByRole('button', { name: 'Delete plan' }));
		const dialog = await screen.findByRole('dialog', { name: 'Delete plan' });
		await user.click(await within(dialog).findByRole('button', { name: 'Delete plan' }));

		expect(
			await screen.findByText(
				'Cannot delete a plan with existing subscriptions. Archive it instead.'
			)
		).toBeInTheDocument();
		expect(await screen.findByRole('button', { name: 'Archive instead' })).toBeInTheDocument();
	});

	it('does not blame subscribers when the delete fails for another reason', async () => {
		const user = userEvent.setup();
		arrangePlans([makePlan()]);
		vi.mocked(organizationadminsubscriptionsDeletePlan).mockResolvedValue({
			data: undefined,
			error: {},
			response: { status: 500 }
		} as never);
		renderList();

		await user.click(await screen.findByRole('button', { name: 'Delete plan' }));
		const dialog = await screen.findByRole('dialog', { name: 'Delete plan' });
		await user.click(await within(dialog).findByRole('button', { name: 'Delete plan' }));

		expect(await screen.findByText("Couldn't delete this plan.")).toBeInTheDocument();
		// Archiving does not unstick a 404/5xx, so the escape hatch stays hidden —
		// this used to be offered for every failure alongside a false "has
		// subscribers" explanation.
		expect(screen.queryByRole('button', { name: 'Archive instead' })).not.toBeInTheDocument();
		expect(screen.queryByText(/has subscribers/i)).not.toBeInTheDocument();
	});
});
