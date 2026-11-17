import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SubscriptionsTab from './SubscriptionsTab.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { organizationadminsubscriptionsListSubscriptions } from '$lib/api/generated/sdk.gen';
import type { OrganizationAdminDetailSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsCreateSubscription: vi.fn(),
	organizationadminsubscriptionsListOrganizationPlans: vi.fn(),
	organizationadminsubscriptionsListSubscriptions: vi.fn()
}));
vi.mock('$lib/stores/auth.svelte', () => ({ authStore: { accessToken: 'test-token' } }));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('./SubscriptionMetrics.svelte', async () => ({
	default: (await import('$lib/test-utils/StubComponent.svelte')).default
}));
vi.mock('./MemberCombobox.svelte', async () => ({
	default: (await import('$lib/test-utils/MemberComboboxStub.svelte')).default
}));

const organization = { id: 'org-1', slug: 'test-org' } as unknown as OrganizationAdminDetailSchema;
const listMock = vi.mocked(organizationadminsubscriptionsListSubscriptions);

function renderTab(props: { initialStatus?: string | null; initialPaymentMethod?: string | null }) {
	listMock.mockResolvedValue({
		data: { results: [], count: 0 },
		error: undefined,
		response: { ok: true } as unknown as Response
	} as never);
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	render(QueryClientTestWrapper, {
		props: { client, component: SubscriptionsTab, componentProps: { organization, ...props } }
	});
}

const lastQuery = () => listMock.mock.calls.at(-1)?.[0]?.query;

beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

describe('SubscriptionsTab payment-method filter', () => {
	it('starts on the dashboard deep link: pending + offline', async () => {
		renderTab({ initialStatus: 'pending', initialPaymentMethod: 'offline' });

		await waitFor(() => expect(listMock).toHaveBeenCalled());
		expect(lastQuery()).toMatchObject({ status: 'pending', payment_method: 'offline' });
		expect(screen.getByLabelText('All payment methods')).toHaveValue('offline');
	});

	it('ignores an unknown payment method from the URL', async () => {
		renderTab({ initialPaymentMethod: 'cheque' });

		await waitFor(() => expect(listMock).toHaveBeenCalled());
		expect(lastQuery()?.payment_method).toBeUndefined();
		expect(screen.getByLabelText('All payment methods')).toHaveValue('all');
	});

	it('can be changed and cleared by the admin', async () => {
		renderTab({ initialPaymentMethod: 'offline' });
		await waitFor(() => expect(listMock).toHaveBeenCalled());

		await userEvent.selectOptions(screen.getByLabelText('All payment methods'), 'free');
		await waitFor(() => expect(lastQuery()?.payment_method).toBe('free'));

		await userEvent.selectOptions(screen.getByLabelText('All payment methods'), 'all');
		await waitFor(() => expect(lastQuery()?.payment_method).toBeUndefined());
	});
});
