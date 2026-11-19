import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import PlanFormModal from './PlanFormModal.svelte';
import { focusSettled } from '$lib/test-utils/focus';

vi.mock('$lib/components/forms/MarkdownEditor.svelte', async () => ({
	default: (await import('$lib/test-utils/MarkdownEditorStub.svelte')).default
}));

const org = { id: 'o1', slug: 'o', is_stripe_connected: true } as never;

async function renderModal(props: Partial<ComponentProps<typeof PlanFormModal>> = {}) {
	const onSave = vi.fn();
	const result = render(PlanFormModal, {
		props: { plan: null, open: true, onClose: vi.fn(), onSave, organization: org, ...props }
	});
	await focusSettled();
	return { onSave, ...result };
}

function makePlan(overrides: Record<string, unknown> = {}) {
	return {
		id: 'p1',
		tier_id: 't1',
		tier_name: 'Gold',
		name: 'Calendar plan',
		price: '10.00',
		currency: 'EUR',
		period_unit: 'month',
		period_count: 1,
		is_active: true,
		payment_method: 'offline',
		sales_status: 'open',
		max_subscriptions: null,
		active_subscription_count: 0,
		description: null,
		period_alignment: 'calendar',
		calendar_start_month: 1,
		first_period_pricing: 'prorated',
		...overrides
	} as never;
}

describe('PlanFormModal calendar alignment (create)', () => {
	it('defaults to rolling and sends no calendar fields', async () => {
		const user = userEvent.setup();
		const { onSave } = await renderModal();
		await user.type(screen.getByLabelText(/^name$/i), 'Plain');
		await user.click(screen.getByRole('button', { name: /create plan/i }));
		const payload = onSave.mock.calls[0][0];
		expect(payload.period_alignment).toBe('rolling');
		expect(payload).not.toHaveProperty('calendar_start_month');
		expect(payload).not.toHaveProperty('first_period_pricing');
	});

	it('creates a monthly calendar plan with period count 1', async () => {
		const user = userEvent.setup();
		const { onSave } = await renderModal();
		await user.type(screen.getByLabelText(/^name$/i), 'Cal');
		const count = screen.getByLabelText(/^every$/i);
		await user.clear(count);
		await user.type(count, '3');
		await user.click(screen.getByRole('radio', { name: /^calendar/i }));
		// The count field is withdrawn and the value forced to 1.
		expect(screen.queryByLabelText(/^every$/i)).toBeNull();
		expect(screen.queryByLabelText(/^starts in$/i)).toBeNull();
		await user.click(screen.getByRole('button', { name: /create plan/i }));
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({
				period_alignment: 'calendar',
				period_unit: 'month',
				period_count: 1,
				first_period_pricing: 'prorated'
			})
		);
		expect(onSave.mock.calls[0][0]).not.toHaveProperty('calendar_start_month');
	});

	it('creates a yearly calendar plan with a start month and full pricing', async () => {
		const user = userEvent.setup();
		const { onSave } = await renderModal();
		await user.type(screen.getByLabelText(/^name$/i), 'Cal year');
		await user.selectOptions(screen.getByLabelText(/^period$/i), 'year');
		await user.click(screen.getByRole('radio', { name: /^calendar/i }));
		await user.selectOptions(screen.getByLabelText(/^starts in$/i), 'September');
		await user.click(screen.getByRole('radio', { name: /^full price/i }));
		await user.click(screen.getByRole('button', { name: /create plan/i }));
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({
				period_alignment: 'calendar',
				period_unit: 'year',
				period_count: 1,
				calendar_start_month: 9,
				first_period_pricing: 'full'
			})
		);
	});

	it('restores the previous period count when switching back to rolling', async () => {
		const user = userEvent.setup();
		await renderModal();
		const count = screen.getByLabelText(/^every$/i);
		await user.clear(count);
		await user.type(count, '3');
		await user.click(screen.getByRole('radio', { name: /^calendar/i }));
		await user.click(screen.getByRole('radio', { name: /^rolling/i }));
		expect(screen.getByLabelText(/^every$/i)).toHaveValue(3);
	});

	it('keeps each radio help text outside its label but linked by aria-describedby', async () => {
		await renderModal();
		const radio = screen.getByRole('radio', { name: /^calendar/i });
		const helpId = radio.getAttribute('aria-describedby') as string;
		const help = document.getElementById(helpId) as HTMLElement;
		expect(help).toBeTruthy();
		expect(help.closest('label')).toBeNull();
		expect(radio.closest('label')).toBeNull();
	});

	it('withdraws lifetime once calendar is chosen', async () => {
		const user = userEvent.setup();
		await renderModal();
		await user.selectOptions(screen.getByLabelText(/^period$/i), 'lifetime');
		await user.click(screen.getByRole('radio', { name: /^calendar/i }));
		expect(screen.getByLabelText(/^period$/i)).toHaveValue('month');
		expect(screen.queryByRole('option', { name: /lifetime/i })).toBeNull();
	});

	it('does not let an online plan choose full first-period pricing', async () => {
		const user = userEvent.setup();
		const { onSave } = await renderModal();
		await user.type(screen.getByLabelText(/^name$/i), 'Online cal');
		await user.click(screen.getByRole('radio', { name: /^calendar/i }));
		await user.click(screen.getByRole('radio', { name: /^full price/i }));
		await user.click(screen.getByRole('radio', { name: /online/i }));
		expect(screen.getByRole('radio', { name: /^full price/i })).toBeDisabled();
		expect(screen.getByRole('radio', { name: /^prorated/i })).toBeChecked();
		const price = screen.getByLabelText(/^price$/i);
		await user.clear(price);
		await user.type(price, '10');
		await user.click(screen.getByRole('button', { name: /create plan/i }));
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ payment_method: 'online', first_period_pricing: 'prorated' })
		);
	});

	it('hides the alignment choice for a free plan', async () => {
		const user = userEvent.setup();
		await renderModal();
		await user.click(screen.getByRole('radio', { name: /^calendar/i }));
		await user.click(screen.getByRole('radio', { name: /free/i }));
		expect(screen.queryByRole('radio', { name: /^calendar/i })).toBeNull();
	});
});

describe('PlanFormModal calendar alignment (edit)', () => {
	it('shows alignment read-only, locks the period and sends only first_period_pricing', async () => {
		const user = userEvent.setup();
		const { onSave } = await renderModal({
			plan: makePlan({ period_unit: 'year', calendar_start_month: 4 })
		});
		expect(screen.queryByRole('radio', { name: /^rolling/i })).toBeNull();
		expect(screen.getByTestId('plan-alignment-readonly')).toHaveTextContent(/calendar.*April/i);
		const unit = screen.getByLabelText(/^period$/i);
		expect(unit).toBeDisabled();
		expect(unit).toHaveAccessibleDescription(/billing period of a calendar plan/i);
		expect(screen.queryByLabelText(/^every$/i)).toBeNull();

		await user.click(screen.getByRole('radio', { name: /^full price/i }));
		await user.click(screen.getByRole('button', { name: /edit plan/i }));
		const payload = onSave.mock.calls[0][0];
		expect(payload.first_period_pricing).toBe('full');
		expect(payload.period_unit).toBe('year');
		expect(payload.period_count).toBe(1);
		expect(payload).not.toHaveProperty('period_alignment');
		expect(payload).not.toHaveProperty('calendar_start_month');
	});

	it('sends no first_period_pricing for a rolling plan', async () => {
		const user = userEvent.setup();
		const { onSave } = await renderModal({ plan: makePlan({ period_alignment: 'rolling' }) });
		expect(screen.getByTestId('plan-alignment-readonly')).toHaveTextContent(/rolling/i);
		await user.click(screen.getByRole('button', { name: /edit plan/i }));
		expect(onSave.mock.calls[0][0]).not.toHaveProperty('first_period_pricing');
	});

	it('locks currency and billing period, with a reason, when there are subscribers', async () => {
		await renderModal({
			plan: makePlan({ period_alignment: 'rolling', active_subscription_count: 2 })
		});
		const currency = screen.getByLabelText(/^currency$/i);
		expect(currency).toBeDisabled();
		expect(currency).toHaveAccessibleDescription(/active subscribers/i);
		expect(screen.getByLabelText(/^period$/i)).toBeDisabled();
		expect(screen.getByLabelText(/^every$/i)).toBeDisabled();
	});

	it('leaves currency and period editable with no subscribers', async () => {
		await renderModal({
			plan: makePlan({ period_alignment: 'rolling', active_subscription_count: 0 })
		});
		expect(screen.getByLabelText(/^currency$/i)).toBeEnabled();
		expect(screen.getByLabelText(/^period$/i)).toBeEnabled();
	});
});
