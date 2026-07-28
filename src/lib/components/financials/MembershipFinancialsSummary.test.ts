import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import MembershipFinancialsSummary from './MembershipFinancialsSummary.svelte';
import { formatMoney } from '$lib/utils/format';
import type { MembershipFinancialsSchema } from '$lib/api/generated/types.gen';

function make(overrides: Partial<MembershipFinancialsSchema> = {}): MembershipFinancialsSchema {
	return {
		currency: 'EUR',
		gross: '1200.00',
		platform_fee: '60.00',
		net: '1100.00',
		payment_count: 12,
		refunded_amount: '100.00',
		...overrides
	};
}

describe('MembershipFinancialsSummary', () => {
	it('renders gross, refunds, platform fee and net for the given currency', () => {
		render(MembershipFinancialsSummary, { props: { data: make() } });

		expect(screen.getByText(formatMoney('1200.00', 'EUR'))).toBeInTheDocument();
		expect(screen.getByText(formatMoney('100.00', 'EUR'))).toBeInTheDocument();
		expect(screen.getByText(formatMoney('60.00', 'EUR'))).toBeInTheDocument();
		expect(screen.getByText(formatMoney('1100.00', 'EUR'))).toBeInTheDocument();
	});

	it('uses a description list so the figures are labelled for screen readers', () => {
		const { container } = render(MembershipFinancialsSummary, { props: { data: make() } });

		const list = container.querySelector('dl');
		expect(list).not.toBeNull();
		expect(list?.querySelectorAll('dt')).toHaveLength(4);
		expect(list?.querySelectorAll('dd')).toHaveLength(4);
	});

	it('shows the payment count', () => {
		render(MembershipFinancialsSummary, { props: { data: make({ payment_count: 7 }) } });
		expect(screen.getByText('Payments: 7')).toBeInTheDocument();
	});

	// The backend reports membership money entirely gross: subscription plans carry
	// no VAT rate. An organizer who missed that could file the wrong taxable base,
	// so the caveat must be on the page, not behind a disclosure.
	it('states that membership revenue is gross and excluded from the taxable base', () => {
		const { container } = render(MembershipFinancialsSummary, { props: { data: make() } });

		expect(screen.getByText(/reported gross/i)).toBeInTheDocument();
		expect(screen.getByText(/excluded from the net taxable/i)).toBeInTheDocument();
		expect(container.querySelector('details')).toBeNull();
	});

	it('explains that the platform fee is reported, not deducted', () => {
		render(MembershipFinancialsSummary, { props: { data: make() } });
		expect(screen.getByText(/billed separately/i)).toBeInTheDocument();
	});
});
