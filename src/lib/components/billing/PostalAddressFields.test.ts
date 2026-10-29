import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import PostalAddressFields from './PostalAddressFields.svelte';
import { emptyPostalAddress, type PostalAddress } from '$lib/utils/postal-address';

function setup(extra: Record<string, unknown> = {}) {
	const value: PostalAddress = emptyPostalAddress();
	return { value, ...render(PostalAddressFields, { idPrefix: 'a', value, ...extra }) };
}

describe('PostalAddressFields', () => {
	it('renders labelled fields with autocomplete tokens', () => {
		setup();
		expect(screen.getByLabelText(/Street and number/)).toHaveAttribute(
			'autocomplete',
			'address-line1'
		);
		expect(screen.getByLabelText(/Address line 2/)).toHaveAttribute(
			'autocomplete',
			'address-line2'
		);
		expect(screen.getByLabelText(/Postal code/)).toHaveAttribute('autocomplete', 'postal-code');
		expect(screen.getByLabelText(/^City/)).toHaveAttribute('autocomplete', 'address-level2');
		expect(screen.getByLabelText(/State \/ province/)).toHaveAttribute(
			'autocomplete',
			'address-level1'
		);
		expect(screen.getByLabelText(/^Country/)).toHaveAttribute('autocomplete', 'country');
		expect(screen.getByRole('group', { name: 'Address' })).toBeInTheDocument();
	});

	it('uses a custom legend', () => {
		setup({ legend: 'Billing address' });
		expect(screen.getByRole('group', { name: 'Billing address' })).toBeInTheDocument();
	});

	it('updates the bound value when typing', async () => {
		const { value } = setup();
		await userEvent.type(screen.getByLabelText(/Street and number/), 'Via Roma 1');
		await userEvent.type(screen.getByLabelText(/^City/), 'Roma');
		await userEvent.selectOptions(screen.getByLabelText(/^Country/), 'IT');
		expect(value.line1).toBe('Via Roma 1');
		expect(value.city).toBe('Roma');
		expect(value.countryCode).toBe('IT');
	});

	it('marks required fields only when required', () => {
		const { unmount } = setup();
		expect(screen.getByLabelText(/Street and number/)).not.toBeRequired();
		unmount();
		setup({ required: true });
		for (const re of [/Street and number/, /Postal code/, /^City/, /^Country/]) {
			const el = screen.getByLabelText(re);
			expect(el).toBeRequired();
			expect(el).toHaveAttribute('aria-required', 'true');
		}
		expect(screen.getByLabelText(/Address line 2/)).not.toBeRequired();
	});

	it('announces errors and links them to the field', () => {
		setup({ errors: { city: 'City is required', countryCode: 'Country is required' } });
		const city = screen.getByLabelText(/^City/);
		expect(city).toHaveAttribute('aria-invalid', 'true');
		const alert = screen.getByText('City is required');
		expect(alert).toHaveAttribute('role', 'alert');
		expect(city).toHaveAttribute('aria-describedby', alert.id);
		const country = screen.getByLabelText(/^Country/);
		expect(country).toHaveAttribute('aria-invalid', 'true');
		expect(country).toHaveAttribute('aria-describedby', screen.getByText('Country is required').id);
		expect(screen.getByLabelText(/Street and number/)).not.toHaveAttribute('aria-invalid');
	});
});
