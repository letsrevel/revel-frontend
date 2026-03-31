import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
import BillingProfileForm from './BillingProfileForm.svelte';

// Mock API functions
vi.mock('$lib/api/generated/sdk.gen', () => ({
	userbillingGetBillingProfile: vi
		.fn()
		.mockResolvedValue({ data: null, response: { status: 404 } }),
	userbillingCreateBillingProfile: vi.fn().mockResolvedValue({ data: {} }),
	userbillingUpdateBillingProfile: vi.fn().mockResolvedValue({ data: {} }),
	userbillingSetVatId: vi.fn().mockResolvedValue({ data: {} }),
	userbillingDeleteVatId: vi.fn().mockResolvedValue({ data: {} })
}));

// Mock paraglide messages
vi.mock('$lib/paraglide/messages.js', () => ({
	'billing.form.title': () => 'Billing Information',
	'billing.form.description': () => 'Your billing details used for invoices.',
	'billing.form.billingName': () => 'Legal Name',
	'billing.form.billingNamePlaceholder': () => 'Full legal name or company name',
	'billing.form.billingAddress': () => 'Billing Address',
	'billing.form.billingAddressPlaceholder': () => 'Street, city, postal code',
	'billing.form.vatCountryCode': () => 'Country',
	'billing.form.vatCountryCodePlaceholder': () => 'e.g. AT, DE, IT',
	'billing.form.billingEmail': () => 'Billing Email (optional)',
	'billing.form.billingEmailPlaceholder': () => 'Falls back to your account email',
	'billing.form.vatId': () => 'VAT ID',
	'billing.form.vatIdPlaceholder': () => 'e.g. ATU12345678',
	'billing.form.vatIdDescription': () =>
		'Optional. Providing a valid EU VAT ID may enable reverse charge.',
	'billing.form.vatIdValidated': () => 'Validated',
	'billing.form.vatIdPending': () => 'Pending validation',
	'billing.form.vatIdNotSet': () => 'Not set',
	'billing.form.setVatId': () => 'Validate',
	'billing.form.removeVatId': () => 'Remove',
	'billing.form.save': () => 'Save billing information',
	'billing.form.update': () => 'Update billing information',
	'billing.form.saving': () => 'Saving...',
	'billing.form.saved': () => 'Billing information saved',
	'billing.form.error': () => 'Failed to save billing information',
	'billing.form.selfBilling': () => 'Self-Billing Agreement',
	'billing.form.selfBillingDescription': () => 'Required under Austrian tax law.',
	'billing.form.selfBillingCheckbox': () =>
		'I agree that Revel may issue invoices on my behalf in accordance with the',
	'billing.form.termsAndConditions': () => 'terms and conditions',
	'billing.form.incomplete': () => 'Billing information is incomplete',
	'billing.form.incompleteDescription': () => 'Please complete all required fields.'
}));

function renderWithQueryClient(props: Record<string, unknown>) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } }
	});
	return render(BillingProfileForm, {
		props,
		context: new Map([['$$_queryClient', queryClient]])
	});
}

describe('BillingProfileForm', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders the form heading', async () => {
		renderWithQueryClient({ authToken: 'test-token' });
		expect(screen.getByText('Billing Information')).toBeInTheDocument();
	});

	it('renders all required form fields', async () => {
		renderWithQueryClient({ authToken: 'test-token' });
		expect(screen.getByLabelText(/Legal Name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Billing Address/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Country/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Billing Email/i)).toBeInTheDocument();
	});

	it('renders save button initially', async () => {
		renderWithQueryClient({ authToken: 'test-token' });
		expect(screen.getByRole('button', { name: /Save billing information/i })).toBeInTheDocument();
	});

	it('does not show self-billing section when showSelfBilling is false (default)', async () => {
		renderWithQueryClient({ authToken: 'test-token' });
		expect(screen.queryByText('Self-Billing Agreement')).not.toBeInTheDocument();
	});

	it('shows self-billing section when showSelfBilling is true', async () => {
		renderWithQueryClient({ authToken: 'test-token', showSelfBilling: true });
		expect(screen.getByText('Self-Billing Agreement')).toBeInTheDocument();
		expect(screen.getByRole('checkbox')).toBeInTheDocument();
	});

	it('self-billing checkbox is keyboard accessible', async () => {
		renderWithQueryClient({ authToken: 'test-token', showSelfBilling: true });
		const checkbox = screen.getByRole('checkbox');
		expect(checkbox).toBeInTheDocument();
		expect(checkbox).not.toBeDisabled();
	});

	it('save button is disabled when billing name is empty', async () => {
		renderWithQueryClient({ authToken: 'test-token' });
		const saveButton = screen.getByRole('button', { name: /Save billing information/i });
		expect(saveButton).toBeDisabled();
	});

	it('renders the form with accessible aria-label', async () => {
		renderWithQueryClient({ authToken: 'test-token' });
		expect(screen.getByRole('form', { name: /Billing Information/i })).toBeInTheDocument();
	});

	it('does not show VAT ID section when no billing profile exists', async () => {
		renderWithQueryClient({ authToken: 'test-token' });
		// VAT ID section only appears after profile exists (hasBillingProfile = true)
		// With 404 response (null profile), the section should not be present
		await waitFor(() => {
			expect(screen.queryByText('VAT ID')).not.toBeInTheDocument();
		});
	});

	it('shows VAT ID section when billing profile exists', async () => {
		const { userbillingGetBillingProfile } = await import('$lib/api/generated/sdk.gen');
		vi.mocked(userbillingGetBillingProfile).mockResolvedValueOnce({
			data: {
				id: '1',
				billing_name: 'Test Company',
				billing_address: 'Test St 1',
				vat_country_code: 'AT',
				billing_email: null,
				vat_id: null,
				vat_id_validated: false,
				self_billing_agreed: false
			},
			response: { status: 200 } as Response,
			error: null
		});

		renderWithQueryClient({ authToken: 'test-token' });

		await waitFor(() => {
			expect(screen.getByText('VAT ID')).toBeInTheDocument();
		});
	});

	it('shows validated badge when VAT ID is validated', async () => {
		const { userbillingGetBillingProfile } = await import('$lib/api/generated/sdk.gen');
		vi.mocked(userbillingGetBillingProfile).mockResolvedValueOnce({
			data: {
				id: '1',
				billing_name: 'Test Company',
				billing_address: 'Test St 1',
				vat_country_code: 'AT',
				billing_email: null,
				vat_id: 'ATU12345678',
				vat_id_validated: true,
				self_billing_agreed: false
			},
			response: { status: 200 } as Response,
			error: null
		});

		renderWithQueryClient({ authToken: 'test-token' });

		await waitFor(() => {
			expect(screen.getByText('Validated')).toBeInTheDocument();
		});
	});

	it('shows pending badge when VAT ID exists but is not validated', async () => {
		const { userbillingGetBillingProfile } = await import('$lib/api/generated/sdk.gen');
		vi.mocked(userbillingGetBillingProfile).mockResolvedValueOnce({
			data: {
				id: '1',
				billing_name: 'Test Company',
				billing_address: 'Test St 1',
				vat_country_code: 'AT',
				billing_email: null,
				vat_id: 'ATU12345678',
				vat_id_validated: false,
				self_billing_agreed: false
			},
			response: { status: 200 } as Response,
			error: null
		});

		renderWithQueryClient({ authToken: 'test-token' });

		await waitFor(() => {
			expect(screen.getByText('Pending validation')).toBeInTheDocument();
		});
	});
});
