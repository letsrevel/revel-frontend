import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PricingPanel from './PricingPanel.svelte';
import * as m from '$lib/paraglide/messages.js';

describe('PricingPanel', () => {
	it('shows the zero price, the semibold fee figure, and the self-manage line', () => {
		render(PricingPanel, { props: { onOpenCalculator: vi.fn() } });
		expect(screen.getByText('€0')).toBeInTheDocument();
		const fee = screen.getByText('3% + €0.50');
		expect(fee.className).toContain('font-semibold');
		expect(screen.getByText(m['home.poster.pricingSelfManage']())).toBeInTheDocument();
	});

	it('opens the fee calculator on button click', async () => {
		const user = userEvent.setup();
		const onOpenCalculator = vi.fn();
		render(PricingPanel, { props: { onOpenCalculator } });
		await user.click(
			screen.getByRole('button', { name: m['learnMore.feeCalculator.calculateYourFees']() })
		);
		expect(onOpenCalculator).toHaveBeenCalledOnce();
	});
});
