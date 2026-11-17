import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import CancelSubscriptionDialog from './CancelSubscriptionDialog.svelte';
import type { SubscriptionSchema } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

function makeSub(overrides: Partial<SubscriptionSchema> = {}): SubscriptionSchema {
	return {
		id: 'sub-1',
		status: 'active',
		user_display_name: 'Ada Lovelace',
		current_period_end: '2026-12-01T00:00:00Z',
		plan: { payment_method: 'online' },
		...overrides
	} as unknown as SubscriptionSchema;
}

function renderDialog(sub: SubscriptionSchema) {
	const onSubmit = vi.fn();
	render(CancelSubscriptionDialog, {
		props: { subscription: sub, open: true, onClose: vi.fn(), onSubmit }
	});
	return { onSubmit };
}

describe('admin CancelSubscriptionDialog', () => {
	it('offers the period-end and immediate choices for a paying subscription', () => {
		renderDialog(makeSub());

		expect(screen.getAllByRole('radio')).toHaveLength(2);
		expect(screen.getByText(m['orgAdmin.members.subscriptions.cancel.immediate']())).toBeVisible();
	});

	describe('an offline subscription still awaiting its first payment', () => {
		const awaiting = () =>
			makeSub({
				status: 'pending',
				member_status: 'awaiting_payment',
				plan: { payment_method: 'offline' } as never
			});

		it('shows one "Cancel request" choice with the never-paid copy', () => {
			renderDialog(awaiting());

			expect(screen.queryAllByRole('radio')).toHaveLength(0);
			expect(
				screen.getByRole('heading', {
					name: m['orgAdmin.members.subscriptions.cancel.requestTitle']()
				})
			).toBeVisible();
			expect(
				screen.getByText(
					m['orgAdmin.members.subscriptions.cancel.requestDesc']({ name: 'Ada Lovelace' })
				)
			).toBeVisible();
			expect(screen.queryByText(/keeps access/i)).toBeNull();
			expect(screen.queryByText(m['orgAdmin.members.subscriptions.cancel.immediate']())).toBeNull();
		});

		it('cancels immediately, with no acknowledgement step', async () => {
			const user = userEvent.setup();
			const { onSubmit } = renderDialog(awaiting());

			await user.click(
				screen.getByRole('button', {
					name: m['orgAdmin.members.subscriptions.cancel.requestConfirm']()
				})
			);

			expect(onSubmit).toHaveBeenCalledWith({ immediate: true });
		});

		it.each(['active', null, undefined] as const)(
			'keeps the normal flow for a pending offline row whose member status is %s',
			(member_status) => {
				renderDialog(
					makeSub({
						status: 'pending',
						member_status,
						plan: { payment_method: 'offline' } as never
					})
				);

				expect(screen.getAllByRole('radio')).toHaveLength(2);
				expect(
					screen.queryByRole('heading', {
						name: m['orgAdmin.members.subscriptions.cancel.requestTitle']()
					})
				).toBeNull();
			}
		);
	});
});
