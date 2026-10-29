import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import TierFormVatSection from './TierFormVatSection.svelte';

vi.mock('$lib/paraglide/messages.js', () => ({
	'tierForm.vatRateOverride': () => 'VAT rate override',
	'tierForm.vatRateOverridePlaceholder': () => 'e.g. 20',
	'tierForm.vatRateOverrideHelp': () => 'Help',
	'tierForm.vatExemptionReason': () => 'VAT exemption reason',
	'tierForm.vatExemptionReasonHint': () => 'Cite a legal provision',
	'tierForm.vatExemptionReasonOrgDefault': (p: { reason: string }) =>
		`Leave empty to use: ${p.reason}`,
	'tierForm.requiredSr': () => '(required)'
}));

const org = (o = {}) => ({
	vatRate: '0',
	invoicingMode: 'auto' as const,
	exemptionReason: '',
	...o
});
const base = {
	paymentMethod: 'online',
	vatRateOverride: '',
	vatExemptionReason: '',
	isPending: false
};

describe('TierFormVatSection', () => {
	it('shows the reason input when the effective rate is 0', () => {
		render(TierFormVatSection, { ...base, orgVat: org() });
		expect(screen.getByLabelText(/VAT exemption reason/)).toHaveAttribute('maxlength', '255');
	});

	it('hides it for a non-zero rate and for free tiers', () => {
		const { unmount } = render(TierFormVatSection, { ...base, orgVat: org({ vatRate: '20' }) });
		expect(screen.queryByLabelText(/VAT exemption reason/)).not.toBeInTheDocument();
		unmount();
		render(TierFormVatSection, { ...base, paymentMethod: 'free', orgVat: org() });
		expect(screen.queryByLabelText(/VAT rate override/)).not.toBeInTheDocument();
	});

	it('marks the input required with an announced error', () => {
		render(TierFormVatSection, { ...base, orgVat: org(), required: true, error: 'Reason needed' });
		const input = screen.getByLabelText(/VAT exemption reason/);
		expect(input).toHaveAttribute('aria-required', 'true');
		expect(input).toHaveAttribute('aria-invalid', 'true');
		expect(screen.getByRole('alert')).toHaveTextContent('Reason needed');
		expect(input.getAttribute('aria-describedby')).toContain('vat-exemption-reason-error');
	});

	it('is not required-marked when not required', () => {
		render(TierFormVatSection, { ...base, orgVat: org() });
		expect(screen.getByLabelText(/VAT exemption reason/)).not.toHaveAttribute('aria-required');
	});

	it('shows the org default hint while the input is empty', async () => {
		render(TierFormVatSection, { ...base, orgVat: org({ exemptionReason: '§4 Nr. 20 UStG' }) });
		expect(screen.getByText('Leave empty to use: §4 Nr. 20 UStG')).toBeInTheDocument();
		await userEvent.type(screen.getByLabelText(/VAT exemption reason/), 'x');
		expect(screen.queryByText(/Leave empty to use/)).not.toBeInTheDocument();
	});

	it('without org context shows the input only for an explicit 0 override', () => {
		const { unmount } = render(TierFormVatSection, { ...base, orgVat: null });
		expect(screen.queryByLabelText(/VAT exemption reason/)).not.toBeInTheDocument();
		unmount();
		render(TierFormVatSection, { ...base, vatRateOverride: '0', orgVat: null });
		expect(screen.getByLabelText(/VAT exemption reason/)).toBeInTheDocument();
	});
});
