import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

const update = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/client', () => ({ client: {} }));
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadminvatUpdateBillingInfo: update
}));

import OrgBillingInfoForm from './OrgBillingInfoForm.svelte';

function info(extra: Record<string, unknown> = {}) {
	return {
		vat_country_code: 'DE',
		vat_rate: '19',
		billing_name: 'ACME',
		billing_email: 'a@b.c',
		billing_address: '',
		billing_address_line1: '',
		billing_address_line2: '',
		billing_postal_code: '',
		billing_city: '',
		billing_subdivision: '',
		billing_country_code: '',
		vat_exemption_reason: '',
		invoicing_mode: 'none',
		einvoice_ready: true,
		einvoice_missing_fields: [],
		...extra
	};
}

function renderIt(extra: Record<string, unknown> = {}) {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: OrgBillingInfoForm,
			componentProps: { slug: 'acme', accessToken: 'tok', hasVatId: false, info: info(extra) }
		}
	});
}

beforeEach(() => update.mockReset().mockResolvedValue({ data: {} }));

describe('OrgBillingInfoForm', () => {
	it('shows the legacy address note when only free text exists', () => {
		renderIt({ billing_address: 'Old St 5, Rome' });
		expect(screen.getByTestId('legacy-address-note')).toHaveTextContent('Old St 5, Rome');
	});

	it('hides the note once a structured address exists', () => {
		renderIt({ billing_address: 'Old', billing_address_line1: 'Main St 1' });
		expect(screen.queryByTestId('legacy-address-note')).not.toBeInTheDocument();
	});

	it('shows the warning nag only when invoicing is on and not ready', () => {
		renderIt({
			invoicing_mode: 'auto',
			einvoice_ready: false,
			einvoice_missing_fields: ['billing_city']
		});
		expect(screen.getByTestId('einvoice-readiness-warning')).toBeInTheDocument();
	});

	it('does not render the warning when invoicing is off', () => {
		renderIt({ einvoice_ready: false, einvoice_missing_fields: ['billing_city'] });
		expect(screen.queryByTestId('einvoice-readiness-warning')).not.toBeInTheDocument();
	});

	it('keeps legacy text in the PATCH when the structured address is empty', async () => {
		renderIt({ billing_address: 'Old St 5, Rome' });
		await userEvent.type(screen.getByLabelText(/Default VAT exemption reason/), '  Art. 132  ');
		await userEvent.click(screen.getByRole('button', { name: /save/i }));
		await waitFor(() => expect(update).toHaveBeenCalled());
		const body = update.mock.calls[0][0].body;
		expect(body.billing_address).toBe('Old St 5, Rome');
		expect(body.vat_exemption_reason).toBe('Art. 132');
		expect(body.billing_address_line1).toBe('');
	});

	it('omits vat_rate and vat_exemption_reason when only the address changed', async () => {
		renderIt({ vat_rate: '0.00' });
		await userEvent.type(screen.getByLabelText(/Street and number/i), 'Main 1');
		await userEvent.click(screen.getByRole('button', { name: /save/i }));
		await waitFor(() => expect(update).toHaveBeenCalled());
		const body = update.mock.calls[0][0].body;
		expect(body.billing_address_line1).toBe('Main 1');
		expect(body).not.toHaveProperty('vat_rate');
		expect(body).not.toHaveProperty('vat_exemption_reason');
	});

	it('does not resend a stale vat_rate after a scheme is declared on a dirty form', async () => {
		const props = (extra: Record<string, unknown>) => ({
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: OrgBillingInfoForm,
			componentProps: { slug: 'acme', accessToken: 'tok', hasVatId: false, info: info(extra) }
		});
		const first = props({ vat_rate: '19' });
		const { rerender } = render(QueryClientTestWrapper, { props: first });
		await userEvent.type(screen.getByLabelText(/Street and number/i), 'Main 1');
		await rerender({
			...first,
			componentProps: {
				...first.componentProps,
				info: info({ vat_rate: '0.00', small_business_scheme: 'de_19' })
			}
		});
		expect(screen.getByLabelText(/VAT rate/i)).toHaveValue(0);
		await userEvent.click(screen.getByRole('button', { name: /save/i }));
		await waitFor(() => expect(update).toHaveBeenCalled());
		const body = update.mock.calls[0][0].body;
		expect(body.billing_address_line1).toBe('Main 1');
		expect(body).not.toHaveProperty('vat_rate');
	});

	it('keeps a rate set by removing the scheme on a dirty form', async () => {
		const props = (extra: Record<string, unknown>) => ({
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: OrgBillingInfoForm,
			componentProps: { slug: 'acme', accessToken: 'tok', hasVatId: false, info: info(extra) }
		});
		const first = props({ vat_rate: '0.00', small_business_scheme: 'de_19' });
		const { rerender } = render(QueryClientTestWrapper, { props: first });
		await userEvent.type(screen.getByLabelText(/Street and number/i), 'Main 1');
		await rerender({
			...first,
			componentProps: {
				...first.componentProps,
				info: info({ vat_rate: '19.50', small_business_scheme: 'none' })
			}
		});
		expect(screen.getByLabelText(/VAT rate/i)).toHaveValue(19.5);
		await userEvent.click(screen.getByRole('button', { name: /save/i }));
		await waitFor(() => expect(update).toHaveBeenCalled());
		const body = update.mock.calls[0][0].body;
		expect(body.billing_address_line1).toBe('Main 1');
		expect(body).not.toHaveProperty('vat_rate');
	});

	it('clears the legacy text when a saved structured address is blanked', async () => {
		renderIt({
			billing_address: 'Main St 1\nBerlin',
			billing_address_line1: 'Main St 1',
			billing_city: 'Berlin',
			billing_postal_code: '10115',
			billing_country_code: 'DE'
		});
		for (const re of [/Street and number/i, /Postal code/i, /^City/i]) {
			await userEvent.clear(screen.getByLabelText(re));
		}
		await userEvent.selectOptions(
			document.getElementById('billing-address-countryCode') as HTMLSelectElement,
			''
		);
		await userEvent.click(screen.getByRole('button', { name: /save/i }));
		await waitFor(() => expect(update).toHaveBeenCalled());
		expect(update.mock.calls[0][0].body.billing_address).toBe('');
	});

	it('does not mark the address required while invoicing is off', () => {
		renderIt({ invoicing_mode: 'none' });
		expect(screen.getByLabelText(/Street and number/i)).not.toBeRequired();
	});

	it('marks the address required once invoicing is on', () => {
		renderIt({ invoicing_mode: 'auto' });
		expect(screen.getByLabelText(/Street and number/i)).toBeRequired();
	});

	it('locks the VAT rate under a small-business scheme', () => {
		renderIt({ small_business_scheme: 'de_19', vat_rate: '0.00' });
		const input = screen.getByLabelText(/VAT rate/i);
		expect(input).toBeDisabled();
		expect(input).toHaveAttribute('aria-describedby', 'billing-vat-rate-help');
		expect(document.getElementById('billing-vat-rate-help')).toHaveTextContent(/0 %/);
	});

	it('leaves the VAT rate editable without a scheme', () => {
		renderIt({ small_business_scheme: 'none' });
		expect(screen.getByLabelText(/VAT rate/i)).not.toBeDisabled();
	});
});
