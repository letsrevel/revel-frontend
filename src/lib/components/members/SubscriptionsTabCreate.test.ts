import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SubscriptionsTab from './SubscriptionsTab.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import {
	organizationadminsubscriptionsCreateSubscription,
	organizationadminsubscriptionsListOrganizationPlans,
	organizationadminsubscriptionsListSubscriptions
} from '$lib/api/generated/sdk.gen';
import type { OrganizationAdminDetailSchema, PlanSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsCreateSubscription: vi.fn(),
	organizationadminsubscriptionsListOrganizationPlans: vi.fn(),
	organizationadminsubscriptionsListSubscriptions: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Heavy neighbours with their own queries are not under test here.
vi.mock('./SubscriptionMetrics.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('./MemberCombobox.svelte', async () => ({
	default: (await import('$lib/test-utils/MemberComboboxStub.svelte')).default
}));

const organization = { id: 'org-1', slug: 'test-org' } as unknown as OrganizationAdminDetailSchema;

const plan = {
	id: 'plan-1',
	tier_id: 'tier-1',
	tier_name: 'Gold',
	name: 'Monthly',
	price: '10.00',
	currency: 'EUR',
	period_unit: 'month',
	period_count: 1,
	payment_method: 'offline',
	sales_status: 'open',
	is_active: true
} as unknown as PlanSchema;

const ok = (data: unknown) => ({
	data,
	error: undefined,
	response: { ok: true } as unknown as Response
});

const createMock = vi.mocked(organizationadminsubscriptionsCreateSubscription);

function renderTab() {
	vi.mocked(organizationadminsubscriptionsListSubscriptions).mockResolvedValue(
		ok({ results: [], count: 0 }) as never
	);
	vi.mocked(organizationadminsubscriptionsListOrganizationPlans).mockResolvedValue(
		ok([plan]) as never
	);
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	render(QueryClientTestWrapper, {
		props: { client, component: SubscriptionsTab, componentProps: { organization } }
	});
}

async function openAndSubmit() {
	await userEvent.click(await screen.findByRole('button', { name: 'Create subscription' }));
	await userEvent.click(await screen.findByRole('button', { name: 'pick member' }));
	await waitFor(() => expect(screen.getByRole('option', { name: /Monthly/ })).toBeInTheDocument());
	await userEvent.selectOptions(screen.getByLabelText('Plan'), 'plan-1');
	await userEvent.click(screen.getByRole('button', { name: 'Create' }));
}

beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

describe('SubscriptionsTab create dialog', () => {
	it('cannot be dismissed with Escape while the create is pending, so the error is not lost', async () => {
		let reject: (v: unknown) => void = vi.fn();
		createMock.mockReturnValue(
			new Promise((_, r) => {
				reject = r;
			}) as never
		);
		renderTab();
		await openAndSubmit();
		await userEvent.keyboard('{Escape}');
		expect(screen.getByRole('dialog', { name: 'Create subscription' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

		// The answer lands while the dialog is still there, and is shown in it.
		reject(new Error('boom'));
		expect(await screen.findByRole('alert')).toHaveTextContent('boom');
	});

	it("shows the backend's refusal in the dialog", async () => {
		createMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'The payment date cannot be in the future.' },
			response: { ok: false } as unknown as Response
		} as never);
		renderTab();
		await openAndSubmit();

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'The payment date cannot be in the future.'
		);
	});

	it("does not show a previous attempt's error when the dialog is opened again", async () => {
		createMock.mockResolvedValue({
			data: undefined,
			error: { detail: 'The payment date cannot be in the future.' },
			response: { ok: false } as unknown as Response
		} as never);
		renderTab();
		await openAndSubmit();
		await screen.findByRole('alert');

		await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		await waitFor(() =>
			expect(screen.queryByRole('dialog', { name: 'Create subscription' })).toBeNull()
		);
		document.body.style.pointerEvents = '';

		await userEvent.click(screen.getByRole('button', { name: 'Create subscription' }));
		await screen.findByRole('dialog', { name: 'Create subscription' });
		expect(screen.queryByRole('alert')).toBeNull();
	});
});
