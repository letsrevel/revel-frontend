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

describe('TierFormPaymentMethodSection - Stripe gate', () => {
	const connectProps = { organizationSlug: 'acme', eventId: 'e1' };

	it('keeps Online selectable when the org is not connected', () => {
		const select = renderSection({ organizationStripeConnected: false, ...connectProps });
		expect(onlineOption(select).disabled).toBe(false);
		expect(onlineOption(select).textContent).not.toMatch(/not connected/i);
	});

	it('not connected + online: shows the Stripe callout, not before', async () => {
		const user = userEvent.setup();
		const select = renderSection({ organizationStripeConnected: false, ...connectProps });
		expect(screen.queryByTestId('tier-stripe-gate')).toBeNull();
		await user.selectOptions(select, 'online');
		expect(screen.getByTestId('tier-stripe-gate')).toHaveTextContent('Online payments need Stripe');
		expect(screen.getByRole('button', { name: 'Connect Stripe' })).toBeTruthy();
	});

	it('"Take payment at the door instead" switches the method', async () => {
		const user = userEvent.setup();
		const select = renderSection({
			organizationStripeConnected: false,
			paymentMethod: 'online',
			...connectProps
		});
		await user.click(screen.getByRole('button', { name: 'Take payment at the door instead' }));
		expect(select.value).toBe('at_the_door');
		expect(screen.queryByTestId('tier-stripe-gate')).toBeNull();
	});

	it('connected but billing incomplete: billing callout with a link', () => {
		renderSection({
			organizationStripeConnected: true,
			billingNeedsAttention: true,
			paymentMethod: 'online',
			...connectProps
		});
		expect(screen.queryByTestId('tier-stripe-gate')).toBeNull();
		const gate = screen.getByTestId('tier-billing-gate');
		expect(gate).toHaveTextContent('Add tax details for online payments');
		expect(screen.getByRole('link', { name: 'Add tax details' })).toHaveAttribute(
			'href',
			'/org/acme/admin/billing'
		);
	});

	it('connected and ready: no callout', () => {
		renderSection({ organizationStripeConnected: true, paymentMethod: 'online', ...connectProps });
		expect(screen.queryByTestId('tier-stripe-gate')).toBeNull();
		expect(screen.queryByTestId('tier-billing-gate')).toBeNull();
	});
});
