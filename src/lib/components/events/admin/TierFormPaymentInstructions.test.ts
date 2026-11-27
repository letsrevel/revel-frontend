import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TierFormPaymentInstructions from './TierFormPaymentInstructions.svelte';

function renderIt(paymentMethod: string, value = ''): void {
	render(TierFormPaymentInstructions, { props: { paymentMethod, value, isPending: false } });
}

const items = (): number =>
	screen.getByTestId('tier-instructions-warnings').querySelectorAll('li').length;

describe('TierFormPaymentInstructions D4 (#1314)', () => {
	it('warns for offline with empty instructions', () => {
		renderIt('offline');
		expect(items()).toBe(1);
	});

	it('does not warn for at_the_door', () => {
		renderIt('at_the_door');
		expect(items()).toBe(0);
	});

	it('does not warn when instructions exist', () => {
		renderIt('offline', 'Pay by bank transfer');
		expect(items()).toBe(0);
	});

	it('clears once text is entered and keeps the editor label', async () => {
		const { rerender } = render(TierFormPaymentInstructions, {
			props: { paymentMethod: 'offline', value: '', isPending: false }
		});
		expect(screen.getByLabelText(/payment instructions/i)).toBeInTheDocument();
		expect(items()).toBe(1);
		await rerender({ paymentMethod: 'offline', value: 'IBAN 123', isPending: false });
		expect(items()).toBe(0);
	});

	it('renders nothing for online', () => {
		renderIt('online');
		expect(screen.queryByTestId('tier-instructions-warnings')).toBeNull();
	});
});
