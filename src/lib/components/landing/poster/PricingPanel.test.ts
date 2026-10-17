import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PricingPanel from './PricingPanel.svelte';
import * as m from '$lib/paraglide/messages.js';
import {
	DEFAULT_PLATFORM_FEE_FIXED,
	DEFAULT_PLATFORM_FEE_PERCENT,
	STRIPE_FEE_FIXED,
	STRIPE_FEE_PERCENT,
	DEFAULT_PLATFORM_VAT_RATE_PERCENT
} from '$lib/utils/fees';

const feeConfig = {
	platformFeeFixed: DEFAULT_PLATFORM_FEE_FIXED,
	platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT,
	stripeFeeFixed: STRIPE_FEE_FIXED,
	stripeFeePercent: STRIPE_FEE_PERCENT,
	vatRate: DEFAULT_PLATFORM_VAT_RATE_PERCENT
};

describe('PricingPanel', () => {
	it('shows the zero price, the semibold fee figure, and the self-manage line', () => {
		render(PricingPanel, { props: { onOpenCalculator: vi.fn(), feeConfig } });
		expect(screen.getByText('€0')).toBeInTheDocument();
		const fee = screen.getByText('3% + €0.50');
		expect(fee.className).toContain('font-semibold');
		expect(screen.getByText(m['home.poster.pricingSelfManage']())).toBeInTheDocument();
	});

	it('opens the fee calculator on button click', async () => {
		const user = userEvent.setup();
		const onOpenCalculator = vi.fn();
		render(PricingPanel, { props: { onOpenCalculator, feeConfig } });
		await user.click(
			screen.getByRole('button', { name: m['learnMore.feeCalculator.calculateYourFees']() })
		);
		expect(onOpenCalculator).toHaveBeenCalledOnce();
	});
});
