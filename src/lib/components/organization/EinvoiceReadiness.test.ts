import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import EinvoiceReadiness from './EinvoiceReadiness.svelte';

describe('EinvoiceReadiness', () => {
	it('lists translated missing fields in the warning variant', () => {
		render(EinvoiceReadiness, {
			props: { variant: 'warning', missingFields: ['billing_city', 'vat_id', 'mystery'] }
		});
		expect(screen.getByTestId('einvoice-readiness-warning')).toBeInTheDocument();
		expect(screen.getByText('City')).toBeInTheDocument();
		expect(screen.getByText(/VIES/)).toBeInTheDocument();
		expect(screen.getByText('mystery')).toBeInTheDocument();
	});
	it('renders gentle info text in the info variant', () => {
		render(EinvoiceReadiness, {
			props: { variant: 'info', missingFields: ['billing_postal_code'] }
		});
		expect(screen.getByTestId('einvoice-readiness-info')).toHaveTextContent(/Postal code/);
		expect(screen.queryByTestId('einvoice-readiness-warning')).not.toBeInTheDocument();
	});
	it('renders nothing without missing fields', () => {
		const { container } = render(EinvoiceReadiness, {
			props: { variant: 'warning', missingFields: [] }
		});
		expect(container.querySelector('[data-testid]')).toBeNull();
	});
});
