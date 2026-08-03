import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PricingPanel from './PricingPanel.svelte';
import * as m from '$lib/paraglide/messages.js';

describe('PricingPanel', () => {
	it('shows the zero price and the comparison line', () => {
		render(PricingPanel, { props: { onOpenCalculator: vi.fn() } });
		expect(screen.getByText('€0')).toBeInTheDocument();
		expect(screen.getByText(m['home.poster.pricingCompare']())).toBeInTheDocument();
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
