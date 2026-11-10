import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import SubscriptionCreateModal from './SubscriptionCreateModal.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { organizationadminsubscriptionsListOrganizationPlans } from '$lib/api/generated/sdk.gen';
import type { OrganizationAdminDetailSchema, PlanSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminsubscriptionsListOrganizationPlans: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

// The real combobox runs its own member query; a one-button stub is enough here.
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

function renderModal(extra: Record<string, unknown> = {}) {
	vi.mocked(organizationadminsubscriptionsListOrganizationPlans).mockResolvedValue({
		data: [plan],
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof organizationadminsubscriptionsListOrganizationPlans>>);
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	const onSubmit = vi.fn();
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: SubscriptionCreateModal,
			componentProps: { organization, open: true, onClose: vi.fn(), onSubmit, ...extra }
		}
	});
	return { onSubmit };
}

async function fillRequired() {
	await userEvent.click(await screen.findByRole('button', { name: 'pick member' }));
	const select = screen.getByLabelText('Plan');
	await waitFor(() => expect(screen.getByRole('option', { name: /Monthly/ })).toBeInTheDocument());
	await userEvent.selectOptions(select, 'plan-1');
}

const create = () => screen.getByRole('button', { name: 'Create' });

beforeEach(() => {
	document.body.style.pointerEvents = '';
	vi.clearAllMocks();
});

describe('SubscriptionCreateModal initial payment date', () => {
	it('only offers the payment date once "record initial payment" is checked', async () => {
		renderModal();
		await screen.findByLabelText('Plan');
		expect(screen.queryByLabelText('Payment date')).toBeNull();
		await userEvent.click(screen.getByLabelText('Record initial payment'));
		expect(screen.getByLabelText('Payment date')).toBeInTheDocument();
	});

	it('explains that the register start date is edited separately', async () => {
		renderModal();
		await userEvent.click(await screen.findByLabelText('Record initial payment'));
		expect(
			screen.getByText(/The membership start date is edited separately, in the register entry/)
		).toBeInTheDocument();
	});

	it('sends initial_payment_occurred_at when a date is set', async () => {
		const { onSubmit } = renderModal();
		await fillRequired();
		await userEvent.click(screen.getByLabelText('Record initial payment'));
		await fireEvent.input(screen.getByLabelText('Payment date'), {
			target: { value: '2026-07-01T10:00' }
		});
		await userEvent.click(create());

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		const payload = onSubmit.mock.calls[0][0];
		expect(payload.initial_payment_amount).toBe('0.00');
		expect(new Date(payload.initial_payment_occurred_at).getTime()).toBe(
			new Date('2026-07-01T10:00').getTime()
		);
	});

	it('omits initial_payment_occurred_at when the date is left empty', async () => {
		const { onSubmit } = renderModal();
		await fillRequired();
		await userEvent.click(screen.getByLabelText('Record initial payment'));
		await userEvent.click(create());

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		const payload = onSubmit.mock.calls[0][0];
		expect(payload.initial_payment_amount).toBe('0.00');
		expect('initial_payment_occurred_at' in payload).toBe(false);
	});

	it('does not send the date when no initial payment is recorded', async () => {
		const { onSubmit } = renderModal();
		await fillRequired();
		await userEvent.click(create());

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect('initial_payment_occurred_at' in onSubmit.mock.calls[0][0]).toBe(false);
	});

	it("surfaces the backend's refusal inside the form", async () => {
		renderModal({ submitError: 'The payment date cannot be in the future.' });
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'The payment date cannot be in the future.'
		);
	});
});
