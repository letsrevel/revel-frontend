import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import AttendeeInvoiceDetail from './AttendeeInvoiceDetail.svelte';
import type { AttendeeInvoiceDetailSchema } from '$lib/api/generated/types.gen';

function invoice(extra: Record<string, unknown> = {}): AttendeeInvoiceDetailSchema {
	return {
		id: 'i1',
		invoice_number: 'INV-1',
		status: 'issued',
		currency: 'EUR',
		buyer_name: 'Bob',
		buyer_email: 'bob@example.com',
		buyer_address: 'Legacy St 9',
		buyer_address_line1: '',
		seller_name: 'Org',
		line_items: [],
		vat_breakdown: [],
		has_mixed_vat_rates: false,
		reverse_charge: false,
		total_net: '10.00',
		total_vat: '0.00',
		total_gross: '10.00',
		vat_rate: '0',
		discount_amount_total: '0',
		discount_code_text: '',
		vat_exemptions: {},
		supply_date: null,
		supply_period_end: null,
		payment_method_label: '',
		card_last4: '',
		issue_blocked_reason: '',
		...extra
	} as unknown as AttendeeInvoiceDetailSchema;
}

const cb = () => ({
	onEdit: vi.fn(),
	onIssue: vi.fn(),
	onDelete: vi.fn(),
	onDownload: vi.fn()
});

describe('AttendeeInvoiceDetail', () => {
	it('shows the legacy address when no structured street is set', () => {
		render(AttendeeInvoiceDetail, { props: { invoice: invoice(), ...cb() } });
		expect(screen.getByTestId('buyer-address')).toHaveTextContent('Legacy St 9');
		expect(screen.getByTestId('buyer-address')).toHaveClass('whitespace-pre-line');
	});

	it('shows the structured block when a street is set', () => {
		render(AttendeeInvoiceDetail, {
			props: {
				invoice: invoice({
					buyer_address_line1: 'Main St 1',
					buyer_postal_code: '10115',
					buyer_city: 'Berlin',
					buyer_country_code: 'DE'
				}),
				...cb()
			}
		});
		const el = screen.getByTestId('buyer-address');
		expect(el.textContent?.trim()).toBe('Main St 1\n10115 Berlin\nGermany');
		expect(el).not.toHaveTextContent('Legacy');
	});

	it('hides exemptions, supply dates and payment line when empty', () => {
		render(AttendeeInvoiceDetail, { props: { invoice: invoice(), ...cb() } });
		expect(screen.queryByTestId('vat-exemptions')).not.toBeInTheDocument();
		expect(screen.queryByTestId('supply-dates')).not.toBeInTheDocument();
		expect(screen.queryByTestId('payment-line')).not.toBeInTheDocument();
	});

	it('shows exemptions, supply period and payment with card digits', () => {
		render(AttendeeInvoiceDetail, {
			props: {
				invoice: invoice({
					vat_exemptions: { E: { text: 'Exempt under Art. 132', code: 'VATEX-EU-132' } },
					supply_date: '2026-03-01',
					supply_period_end: '2026-03-31',
					payment_method_label: 'Credit card',
					card_last4: '4242'
				}),
				...cb()
			}
		});
		expect(screen.getByTestId('vat-exemptions')).toHaveTextContent(
			'Exemption (E): Exempt under Art. 132 VATEX-EU-132'
		);
		expect(screen.getByText('VATEX-EU-132')).toHaveClass('font-mono');
		const supply = screen.getByTestId('supply-dates');
		expect(supply).toHaveTextContent('Supply period');
		expect(supply).toHaveTextContent(/Mar 1, 2026/);
		expect(supply).toHaveTextContent(/Mar 31, 2026/);
		expect(screen.getByTestId('payment-line')).toHaveTextContent(/Credit card.*4242/);
	});

	it('shows the seller tax number when present', () => {
		render(AttendeeInvoiceDetail, {
			props: { invoice: invoice({ seller_tax_registration_number: '12/345/67890' }), ...cb() }
		});
		expect(screen.getByText(/Tax no\.: 12\/345\/67890/)).toBeInTheDocument();
	});

	it('hides the seller tax number when empty', () => {
		render(AttendeeInvoiceDetail, {
			props: { invoice: invoice({ seller_tax_registration_number: '' }), ...cb() }
		});
		expect(screen.queryByText(/Tax no\./)).not.toBeInTheDocument();
	});

	it('shows a rounding row only when non-zero', () => {
		const { unmount } = render(AttendeeInvoiceDetail, {
			props: { invoice: invoice({ rounding_amount: '0.01' }), ...cb() }
		});
		expect(screen.getByText('Rounding')).toBeInTheDocument();
		unmount();
		render(AttendeeInvoiceDetail, {
			props: { invoice: invoice({ rounding_amount: '0.00' }), ...cb() }
		});
		expect(screen.queryByText('Rounding')).not.toBeInTheDocument();
	});
});
