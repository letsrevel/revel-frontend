import { render, screen, type RenderResult } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TierFormPricingSection from './TierFormPricingSection.svelte';
import { formatMoney } from '$lib/utils/format';

const platformFees = { percent: 1.5, fixed: 0.25, vatRate: 0 };

function renderSection(priceType: 'fixed' | 'pwyc'): RenderResult<typeof TierFormPricingSection> {
	return render(TierFormPricingSection, {
		props: {
			priceType,
			currency: 'EUR',
			price: '20.00',
			pwycMin: '20.00',
			pwycMax: '',
			currencySymbol: '€',
			isPending: false,
			platformFees,
			showNetPayout: true
		}
	});
}

// #948: the fixed fees are charged once per order, so the preview is the
// single-ticket worst case — and must say so.
describe('TierFormPricingSection net payout preview', () => {
	it('labels the fixed-price estimate as a single-ticket order', () => {
		renderSection('fixed');

		// 20 − (0.30 + 0.25) Stripe − (0.30 + 0.25) platform = 18.90
		expect(screen.getByText(`~${formatMoney(18.9, 'EUR')}`)).toBeInTheDocument();
		expect(screen.getByText('per ticket (single-ticket order)')).toBeInTheDocument();
	});

	it('labels the PWYC estimate as a single-ticket order at the minimum price', () => {
		renderSection('pwyc');

		expect(
			screen.getByText('per ticket (single-ticket order, at the minimum price)')
		).toBeInTheDocument();
	});
});
