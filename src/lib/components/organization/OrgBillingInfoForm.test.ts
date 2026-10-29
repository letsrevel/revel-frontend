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
});
