import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AttendeeInvoiceEditForm from './AttendeeInvoiceEditForm.svelte';
import type { AttendeeInvoiceDetailSchema } from '$lib/api/generated/types.gen';

const inv = {
	buyer_name: 'Bob',
	buyer_email: 'bob@example.com',
	buyer_vat_id: '',
	buyer_vat_country: '',
	buyer_address: 'Legacy',
	buyer_address_line1: 'Main St 1',
	buyer_address_line2: '',
	buyer_postal_code: '10115',
	buyer_city: 'Berlin',
	buyer_subdivision: '',
	buyer_country_code: 'DE'
} as unknown as AttendeeInvoiceDetailSchema;

describe('AttendeeInvoiceEditForm', () => {
	it('prefills structured fields, hints about the legacy field and submits buyer_* fields', async () => {
		const onSave = vi.fn();
		render(AttendeeInvoiceEditForm, { props: { invoice: inv, onSave, onCancel: vi.fn() } });
		expect(screen.getByLabelText(/Street and number/)).toHaveValue('Main St 1');
		expect(screen.getByLabelText(/Legacy single-line|Address$/)).toBeInTheDocument();
		expect(screen.getByText(/PDF prints the structured block/)).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: /Save/ }));
		expect(onSave).toHaveBeenCalledTimes(1);
		const body = onSave.mock.calls[0][0];
		expect(body.buyer_address_line1).toBe('Main St 1');
		expect(body.buyer_country_code).toBe('DE');
		expect(body.buyer_address).toBe('Legacy');
	});
});
