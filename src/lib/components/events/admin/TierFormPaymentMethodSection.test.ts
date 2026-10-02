import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { EventComplianceSchema } from '$lib/api/generated/types.gen';
import TierFormPaymentMethodSection from './TierFormPaymentMethodSection.svelte';

function compliance(overrides: Partial<EventComplianceSchema> = {}): EventComplianceSchema {
	return {
		venue_country: 'DE',
		online_payment: 'allowed',
		offline_payment: 'allowed',
		attendee_invoicing: 'allowed',
		notices: [],
		...overrides
	};
}

function renderSection(props: Record<string, unknown>) {
	render(TierFormPaymentMethodSection, {
		props: {
			paymentMethod: 'free',
			isPending: false,
			organizationStripeConnected: true,
			...props
		}
	});
	return screen.getByLabelText(/Payment Method/) as HTMLSelectElement;
}

function onlineOption(select: HTMLSelectElement): HTMLOptionElement {
	return select.querySelector('option[value="online"]') as HTMLOptionElement;
}

// #1001: the editor must never offer card payment it can't vouch for.
describe('TierFormPaymentMethodSection — country rules', () => {
	it('offers card payment once the rules have loaded and allow it', () => {
		const select = renderSection({ compliance: compliance(), complianceStatus: 'ready' });
		expect(onlineOption(select).disabled).toBe(false);
		expect(select).not.toHaveAttribute('aria-describedby');
	});

	it('disables card payment with the reason when the event country blocks it', () => {
		const select = renderSection({
			compliance: compliance({ venue_country: 'IT', online_payment: 'blocked' }),
			complianceStatus: 'ready'
		});
		expect(onlineOption(select).disabled).toBe(true);
		expect(select).toHaveAccessibleDescription(/Online card payments aren't available/);
		for (const method of ['free', 'offline', 'at_the_door']) {
			expect(
				(select.querySelector(`option[value="${method}"]`) as HTMLOptionElement).disabled
			).toBe(false);
		}
	});

	it('fails closed while the rules are still loading', () => {
		const select = renderSection({ compliance: null, complianceStatus: 'loading' });
		expect(onlineOption(select).disabled).toBe(true);
		expect(select).toHaveAccessibleDescription(/Checking this event's country rules/);
	});

	it('fails closed when the rules failed to load, and offers a retry', async () => {
		const onRetryCompliance = vi.fn();
		const select = renderSection({
			compliance: null,
			complianceStatus: 'error',
			onRetryCompliance
		});
		expect(onlineOption(select).disabled).toBe(true);
		expect(select).toHaveAccessibleDescription(/couldn't check this event's country rules/);
		await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
		expect(onRetryCompliance).toHaveBeenCalledOnce();
	});
});
