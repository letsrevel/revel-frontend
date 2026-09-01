import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import InvoiceVatBreakdownTable from './InvoiceVatBreakdownTable.svelte';
import { formatMoney } from '$lib/utils/format';
import type { InvoiceVatBucketSchema } from '$lib/api/generated';

const buckets: InvoiceVatBucketSchema[] = [
	{ vat_rate: '10.00', net_amount: '90.91', vat_amount: '9.09', gross_amount: '100.00' },
	{ vat_rate: '22.00', net_amount: '163.93', vat_amount: '36.07', gross_amount: '200.00' }
];

describe('InvoiceVatBreakdownTable', () => {
	it('renders one row per VAT rate with its amounts', () => {
		render(InvoiceVatBreakdownTable, { props: { buckets, currency: 'EUR' } });

		expect(screen.getByRole('rowheader', { name: '10.00%' })).toBeInTheDocument();
		expect(screen.getByRole('rowheader', { name: '22.00%' })).toBeInTheDocument();
		expect(screen.getByText(formatMoney('90.91', 'EUR'))).toBeInTheDocument();
		expect(screen.getByText(formatMoney('36.07', 'EUR'))).toBeInTheDocument();
		expect(screen.getByText(formatMoney('200.00', 'EUR'))).toBeInTheDocument();
	});

	it('labels the table for screen readers via a caption', () => {
		render(InvoiceVatBreakdownTable, { props: { buckets, currency: 'EUR' } });

		expect(screen.getByRole('table', { name: /vat rate/i })).toBeInTheDocument();
	});

	it('renders nothing for an empty bucket list', () => {
		const { container } = render(InvoiceVatBreakdownTable, {
			props: { buckets: [], currency: 'EUR' }
		});

		expect(container.querySelector('table')).toBeNull();
	});
});
