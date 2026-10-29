import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/svelte-query';
import BillingProfileForm from './BillingProfileForm.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

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
	'billing.form.incompleteDescription': () => 'Please complete all required fields.',
	'einvoice.legacyNote': (p: { text: string }) => `Address on file: ${p.text} Please re-enter it.`,
	'postalAddress.legend': () => 'Address',
	'postalAddress.line1': () => 'Street and number',
	'postalAddress.line2': () => 'Address line 2',
	'postalAddress.postalCode': () => 'Postal code',
	'postalAddress.city': () => 'City',
	'postalAddress.subdivision': () => 'Region',
	'postalAddress.country': () => 'Address country',
	'postalAddress.countryPlaceholder': () => 'Select a country',
	'postalAddress.requiredSr': () => '(required)'
}));

function renderWithQueryClient(props: Record<string, unknown>) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } }
	});
	return render(QueryClientTestWrapper, {
		props: { client: queryClient, component: BillingProfileForm, componentProps: props }
	});
}

describe('BillingProfileForm', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders the form with its accessible title', async () => {
		renderWithQueryClient({ authToken: 'test-token' });
		// The title is exposed as the form's aria-label (no visible heading anymore)
		expect(screen.getByRole('form', { name: 'Billing Information' })).toBeInTheDocument();
	});

	it('renders all required form fields', async () => {
		renderWithQueryClient({ authToken: 'test-token' });
		expect(screen.getByLabelText(/Legal Name/i)).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Billing Address' })).toBeInTheDocument();
		expect(screen.getByLabelText(/Street and number/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Postal code/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^City/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^Country/)).toBeInTheDocument();
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

	it('shows only a VAT ID hint (no controls) when no billing profile exists', async () => {
		renderWithQueryClient({ authToken: 'test-token' });
		// Without a billing profile the VAT ID section renders as an informational
		// hint: heading + description, but no input or Validate/Remove controls.
		await waitFor(() => {
			expect(screen.getByText('VAT ID')).toBeInTheDocument();
		});
		expect(screen.queryByRole('button', { name: 'Validate' })).not.toBeInTheDocument();
		expect(screen.queryByRole('textbox', { name: 'VAT ID' })).not.toBeInTheDocument();
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

	const structured = {
		id: '1',
		billing_name: 'Test Company',
		billing_address: 'Old St 1',
		billing_address_line1: 'Main St 1',
		billing_address_line2: '',
		billing_postal_code: '1010',
		billing_city: 'Vienna',
		billing_subdivision: '',
		billing_country_code: 'AT',
		vat_country_code: 'AT',
		billing_email: null,
		vat_id: null,
		vat_id_validated: false,
		self_billing_agreed: false
	};

	it('prefills the structured address and sends all six fields on save', async () => {
		const sdk = await import('$lib/api/generated/sdk.gen');
		vi.mocked(sdk.userbillingGetBillingProfile).mockResolvedValueOnce({
			data: structured,
			response: { status: 200 } as Response,
			error: null
		});
		renderWithQueryClient({ authToken: 'test-token' });
		await waitFor(() =>
			expect(screen.getByLabelText(/Street and number/i)).toHaveValue('Main St 1')
		);
		expect(screen.queryByTestId('legacy-address-note')).not.toBeInTheDocument();

		const user = userEvent.setup();
		const city = screen.getByLabelText(/^City/i);
		await user.clear(city);
		await user.type(city, 'Graz');
		await user.click(screen.getByRole('button', { name: /Update billing information/i }));

		await waitFor(() => expect(sdk.userbillingUpdateBillingProfile).toHaveBeenCalled());
		const body = vi.mocked(sdk.userbillingUpdateBillingProfile).mock.calls[0][0]!.body as Record<
			string,
			string
		>;
		expect(body.billing_address_line1).toBe('Main St 1');
		expect(body.billing_city).toBe('Graz');
		expect(body.billing_postal_code).toBe('1010');
		expect(body.billing_country_code).toBe('AT');
		expect(body.billing_address_line2).toBe('');
		expect(body.billing_subdivision).toBe('');
		expect(body.billing_address).toContain('Main St 1');
		expect(body.billing_address).toContain('1010 Graz');
	});

	it('keeps legacy text and shows a note when only legacy address exists', async () => {
		const sdk = await import('$lib/api/generated/sdk.gen');
		vi.mocked(sdk.userbillingGetBillingProfile).mockResolvedValueOnce({
			data: {
				...structured,
				billing_address_line1: '',
				billing_postal_code: '',
				billing_city: '',
				billing_country_code: ''
			},
			response: { status: 200 } as Response,
			error: null
		});
		renderWithQueryClient({ authToken: 'test-token' });
		await waitFor(() => expect(screen.getByTestId('legacy-address-note')).toBeInTheDocument());
		// legacy text counts as complete: no incomplete warning
		expect(screen.queryByText('Billing information is incomplete')).not.toBeInTheDocument();

		const user = userEvent.setup();
		await user.click(screen.getByRole('button', { name: /Update billing information/i }));
		await waitFor(() => expect(sdk.userbillingUpdateBillingProfile).toHaveBeenCalled());
		const body = vi.mocked(sdk.userbillingUpdateBillingProfile).mock.calls[0][0]!.body as Record<
			string,
			string
		>;
		expect(body.billing_address).toBe('Old St 1');
		expect(body.billing_address_line1).toBe('');
	});

	it('warns when profile has name and country but no address at all', async () => {
		const sdk = await import('$lib/api/generated/sdk.gen');
		vi.mocked(sdk.userbillingGetBillingProfile).mockResolvedValueOnce({
			data: {
				...structured,
				billing_address: '',
				billing_address_line1: '',
				billing_postal_code: '',
				billing_city: '',
				billing_country_code: ''
			},
			response: { status: 200 } as Response,
			error: null
		});
		renderWithQueryClient({ authToken: 'test-token' });
		await waitFor(() =>
			expect(screen.getByText('Billing information is incomplete')).toBeInTheDocument()
		);
	});
});
