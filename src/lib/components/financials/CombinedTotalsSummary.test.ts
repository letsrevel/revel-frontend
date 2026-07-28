import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import CombinedTotalsSummary from './CombinedTotalsSummary.svelte';
import { formatMoney } from '$lib/utils/format';
import type { CombinedTotalsSchema } from '$lib/api/generated/types.gen';

function make(overrides: Partial<CombinedTotalsSchema> = {}): CombinedTotalsSchema {
	return {
		currency: 'EUR',
		tickets_net: '800.00',
		memberships_net: '250.00',
		net: '1050.00',
		...overrides
	};
}

describe('CombinedTotalsSummary', () => {
	it('renders the two components and their sum', () => {
		render(CombinedTotalsSummary, { props: { data: make() } });

		expect(screen.getByText(formatMoney('800.00', 'EUR'))).toBeInTheDocument();
		expect(screen.getByText(formatMoney('250.00', 'EUR'))).toBeInTheDocument();
		expect(screen.getByText(formatMoney('1050.00', 'EUR'))).toBeInTheDocument();
	});

	it('uses a description list so the figures are labelled for screen readers', () => {
		const { container } = render(CombinedTotalsSummary, { props: { data: make() } });

		const list = container.querySelector('dl');
		expect(list).not.toBeNull();
		expect(list?.querySelectorAll('dt')).toHaveLength(3);
		expect(list?.querySelectorAll('dd')).toHaveLength(3);
	});

	// The sum mixes a VAT-decomposed ticket component with an untreated membership
	// one, so it is a cash-flow figure and must never be filed as taxable turnover.
	it('warns that the total is cash flow, not a tax figure', () => {
		const { container } = render(CombinedTotalsSummary, { props: { data: make() } });

		expect(screen.getByText(/cash-flow total, not a tax figure/i)).toBeInTheDocument();
		expect(screen.getByText(/must not be filed as taxable turnover/i)).toBeInTheDocument();
		expect(container.querySelector('details')).toBeNull();
	});
});
