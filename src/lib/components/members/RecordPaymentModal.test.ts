import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import RecordPaymentModal from './RecordPaymentModal.svelte';
import type { SubscriptionSchema } from '$lib/api/generated/types.gen';

const subscription = {
	id: 'sub-1',
	plan: { price: '10.00', currency: 'EUR' }
} as unknown as SubscriptionSchema;

describe('RecordPaymentModal status options', () => {
	// The record endpoint answers 422 to `voided`: a payment is voided through its
	// own action, never recorded as voided.
	it('does not offer voided (or refunded) as a status to record', async () => {
		render(RecordPaymentModal, {
			props: { subscription, open: true, onClose: vi.fn(), onSubmit: vi.fn() }
		});
		const status = await screen.findByLabelText('Status');
		const values = Array.from(status.querySelectorAll('option')).map((o) => o.value);
		expect(values).toEqual(['succeeded', 'pending', 'failed']);
	});
});
