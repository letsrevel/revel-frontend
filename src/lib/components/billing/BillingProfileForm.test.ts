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

const toastMock = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: toastMock }));

// Mock paraglide messages
vi.mock('$lib/paraglide/messages.js', () => ({
	'billing.form.title': () => 'Billing Information',
	'billing.form.description': () => 'Your billing details used for invoices.',
	'billing.form.billingName': () => 'Legal Name',
	'billing.form.billingNamePlaceholder': () => 'Full legal name or company name',
	'billing.form.billingAddress': () => 'Billing Address',
	'billing.form.billingAddressPlaceholder': () => 'Street, city, postal code',
	'billing.form.vatCountryCode': () => 'VAT country',
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
	'billing.form.revalidateVatId': () => 'Validate again',
	'billing.form.vatSavedPending': () => 'VAT ID saved. Validation is pending.',
	'billing.form.vatSavedUnvalidated': () => 'VAT ID saved, not validated yet.',
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
	'postalAddress.requiredSr': () => '(required)',
	'postalAddress.errors.line1': () => 'Street and number are required',
	'postalAddress.errors.postalCode': () => 'Postal code is required',
	'postalAddress.errors.city': () => 'City is required',
	'postalAddress.errors.countryCode': () => 'Country is required'
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

	it('renders all form fields; name, VAT country and the address are required', async () => {
		renderWithQueryClient({ authToken: 'test-token' });
		expect(screen.getByLabelText(/Legal Name/i)).toBeRequired();
		expect(screen.getByLabelText(/Street and number/i)).toBeRequired();
		expect(screen.getByLabelText(/Billing Email/i)).not.toBeRequired();
		expect(screen.getByLabelText(/Legal Name/i)).toBeInTheDocument();
		expect(screen.getByRole('group', { name: 'Billing Address' })).toBeInTheDocument();
		expect(screen.getByLabelText(/Street and number/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Postal code/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^City/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^VAT country/)).toBeInTheDocument();
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

	describe('re-validating a saved VAT ID', () => {
		const withVat = (validated: boolean) => ({
			id: '1',
			billing_name: 'Test Company',
			billing_address: 'Test St 1',
			vat_country_code: 'AT',
			billing_email: null,
			vat_id: 'ATU12345678',
			vat_id_validated: validated,
			self_billing_agreed: false
		});

		it('shows "Validate again" for a saved but unvalidated VAT ID and retries the stored ID', async () => {
			const sdk = await import('$lib/api/generated/sdk.gen');
			vi.mocked(sdk.userbillingGetBillingProfile).mockResolvedValueOnce({
				data: withVat(false),
				response: { status: 200 } as Response,
				error: null
			});
			renderWithQueryClient({ authToken: 'test-token' });
			const button = await screen.findByRole('button', { name: 'Validate again' });
			await userEvent.setup().click(button);
			await waitFor(() =>
				expect(sdk.userbillingSetVatId).toHaveBeenCalledWith(
					expect.objectContaining({ body: { vat_id: 'ATU12345678' } })
				)
			);
		});

		it('hides "Validate again" once the VAT ID is validated', async () => {
			const sdk = await import('$lib/api/generated/sdk.gen');
			vi.mocked(sdk.userbillingGetBillingProfile).mockResolvedValueOnce({
				data: withVat(true),
				response: { status: 200 } as Response,
				error: null
			});
			renderWithQueryClient({ authToken: 'test-token' });
			await screen.findByText('Validated');
			expect(screen.queryByRole('button', { name: 'Validate again' })).not.toBeInTheDocument();
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
		const body = vi.mocked(sdk.userbillingUpdateBillingProfile).mock.calls[0][0].body as Record<
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
		const body = vi.mocked(sdk.userbillingUpdateBillingProfile).mock.calls[0][0].body as Record<
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

	it('blocks save, announces errors and focuses the first when the address is blanked', async () => {
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
		const user = userEvent.setup();
		for (const re of [/Street and number/i, /Postal code/i, /^City/i]) {
			await user.clear(screen.getByLabelText(re));
		}
		await user.click(screen.getByRole('button', { name: /Update billing information/i }));
		expect(await screen.findByText('Street and number are required')).toHaveAttribute(
			'role',
			'alert'
		);
		expect(screen.getByText('Postal code is required')).toBeInTheDocument();
		expect(screen.getByText('City is required')).toBeInTheDocument();
		await waitFor(() => expect(screen.getByLabelText(/Street and number/i)).toHaveFocus());
		expect(sdk.userbillingUpdateBillingProfile).not.toHaveBeenCalled();
	});

	it('does not count a partial structured address as complete', async () => {
		const sdk = await import('$lib/api/generated/sdk.gen');
		vi.mocked(sdk.userbillingGetBillingProfile).mockResolvedValueOnce({
			data: { ...structured, billing_postal_code: '', billing_city: '' },
			response: { status: 200 } as Response,
			error: null
		});
		renderWithQueryClient({ authToken: 'test-token' });
		await waitFor(() =>
			expect(screen.getByText('Billing information is incomplete')).toBeInTheDocument()
		);
	});

	it('re-seeds the VAT country from the refetched profile after setting a VAT ID, keeping other edits', async () => {
		const sdk = await import('$lib/api/generated/sdk.gen');
		vi.mocked(sdk.userbillingGetBillingProfile)
			.mockResolvedValueOnce({
				data: structured,
				response: { status: 200 } as Response,
				error: null
			})
			.mockResolvedValue({
				data: { ...structured, vat_country_code: 'DE', vat_id: 'DE123456789' },
				response: { status: 200 } as Response,
				error: null
			});
		renderWithQueryClient({ authToken: 'test-token' });
		await waitFor(() => expect(screen.getByLabelText(/^City/i)).toHaveValue('Vienna'));
		const user = userEvent.setup();
		const city = screen.getByLabelText(/^City/i);
		await user.clear(city);
		await user.type(city, 'Graz');

		await user.type(screen.getByLabelText('VAT ID'), 'DE123456789');
		await user.click(screen.getByRole('button', { name: 'Validate' }));

		await waitFor(() => expect(document.getElementById('vatCountryCode')).toHaveValue('DE'));
		expect(screen.getByLabelText(/^City/i)).toHaveValue('Graz');
	});

	it('does not wipe in-progress edits when the profile refetches', async () => {
		const sdk = await import('$lib/api/generated/sdk.gen');
		vi.mocked(sdk.userbillingGetBillingProfile).mockResolvedValue({
			data: structured,
			response: { status: 200 } as Response,
			error: null
		});
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: BillingProfileForm,
				componentProps: { authToken: 'test-token' }
			}
		});
		await waitFor(() => expect(screen.getByLabelText(/^City/i)).toHaveValue('Vienna'));
		const user = userEvent.setup();
		const city = screen.getByLabelText(/^City/i);
		await user.clear(city);
		await user.type(city, 'Graz');

		await queryClient.refetchQueries({ queryKey: ['user-billing-profile'] });
		await new Promise((r) => setTimeout(r, 30));
		expect(screen.getByLabelText(/^City/i)).toHaveValue('Graz');
	});

	describe('VAT ID set with VIES unavailable (503)', () => {
		async function submitVat(
			errorBody: unknown,
			status = 503
		): Promise<{ sdk: typeof import('$lib/api/generated/sdk.gen') }> {
			const sdk = await import('$lib/api/generated/sdk.gen');
			vi.mocked(sdk.userbillingGetBillingProfile).mockResolvedValue({
				data: structured,
				response: { status: 200 } as Response,
				error: null
			});
			vi.mocked(sdk.userbillingSetVatId).mockResolvedValueOnce({
				data: undefined,
				error: errorBody,
				response: { status } as Response
			} as never);
			renderWithQueryClient({ authToken: 'test-token' });
			await waitFor(() => expect(screen.getByLabelText(/^City/i)).toHaveValue('Vienna'));
			const user = userEvent.setup();
			await user.type(screen.getByLabelText('VAT ID'), 'DE123456789');
			await user.click(screen.getByRole('button', { name: 'Validate' }));
			return { sdk };
		}

		it('saved_pending: info toast and refetch', async () => {
			const { sdk } = await submitVat({ detail: 'd', code: 'vies_unavailable_saved_pending' });
			await waitFor(() =>
				expect(toastMock.info).toHaveBeenCalledWith('VAT ID saved. Validation is pending.')
			);
			expect(toastMock.error).not.toHaveBeenCalled();
			await waitFor(() =>
				expect(vi.mocked(sdk.userbillingGetBillingProfile).mock.calls.length).toBeGreaterThan(1)
			);
		});

		it.each([
			['saved_unvalidated', { detail: 'd', code: 'vies_unavailable_saved_unvalidated' }],
			['unknown code', { detail: 'd', code: 'something_new' }],
			['no body', {}]
		])('%s: unvalidated info toast and refetch', async (_n, body) => {
			const { sdk } = await submitVat(body);
			await waitFor(() =>
				expect(toastMock.info).toHaveBeenCalledWith('VAT ID saved, not validated yet.')
			);
			expect(toastMock.error).not.toHaveBeenCalled();
			await waitFor(() =>
				expect(vi.mocked(sdk.userbillingGetBillingProfile).mock.calls.length).toBeGreaterThan(1)
			);
		});

		it('not_saved: error toast with server detail, no refetch, typed value kept', async () => {
			const { sdk } = await submitVat({
				detail: 'VIES is down, nothing saved',
				code: 'vies_unavailable_not_saved'
			});
			await waitFor(() =>
				expect(toastMock.error).toHaveBeenCalledWith('VIES is down, nothing saved')
			);
			expect(toastMock.info).not.toHaveBeenCalled();
			expect(vi.mocked(sdk.userbillingGetBillingProfile)).toHaveBeenCalledTimes(1);
			expect(screen.getByLabelText('VAT ID')).toHaveValue('DE123456789');
		});

		it('not_saved without detail falls back to the generic message', async () => {
			await submitVat({ code: 'vies_unavailable_not_saved' });
			await waitFor(() =>
				expect(toastMock.error).toHaveBeenCalledWith('Failed to save billing information')
			);
		});

		it('non-503 error shows the server message', async () => {
			await submitVat({ detail: 'Invalid VAT ID' }, 400);
			await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Invalid VAT ID'));
		});

		it('400 refetches the profile (backend cleared the VAT ID), reseeds country, keeps typed input', async () => {
			const sdk = await import('$lib/api/generated/sdk.gen');
			vi.mocked(sdk.userbillingGetBillingProfile)
				.mockResolvedValueOnce({
					data: { ...structured, vat_country_code: 'AT' },
					response: { status: 200 } as Response,
					error: null
				})
				.mockResolvedValue({
					data: { ...structured, vat_country_code: '', vat_id: '' },
					response: { status: 200 } as Response,
					error: null
				});
			vi.mocked(sdk.userbillingSetVatId).mockResolvedValueOnce({
				data: undefined,
				error: { detail: 'Invalid VAT ID' },
				response: { status: 400 } as Response
			} as never);
			renderWithQueryClient({ authToken: 'test-token' });
			await waitFor(() => expect(document.getElementById('vatCountryCode')).toHaveValue('AT'));
			const user = userEvent.setup();
			await user.type(screen.getByLabelText('VAT ID'), 'DE123456789');
			await user.click(screen.getByRole('button', { name: 'Validate' }));
			await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('Invalid VAT ID'));
			await waitFor(() => expect(document.getElementById('vatCountryCode')).toHaveValue(''));
			expect(vi.mocked(sdk.userbillingGetBillingProfile).mock.calls.length).toBeGreaterThan(1);
			expect(screen.getByLabelText('VAT ID')).toHaveValue('DE123456789');
		});

		it('keeps an edit made while the set-VAT request was in flight', async () => {
			const sdk = await import('$lib/api/generated/sdk.gen');
			vi.mocked(sdk.userbillingGetBillingProfile).mockResolvedValue({
				data: structured,
				response: { status: 200 } as Response,
				error: null
			});
			let release: (v: never) => void = (): void => undefined;
			vi.mocked(sdk.userbillingSetVatId).mockReturnValueOnce(
				new Promise((r) => {
					release = r as never;
				}) as never
			);
			renderWithQueryClient({ authToken: 'test-token' });
			await waitFor(() => expect(screen.getByLabelText(/^City/i)).toHaveValue('Vienna'));
			const user = userEvent.setup();
			const input = screen.getByLabelText('VAT ID');
			await user.type(input, 'DE123456789');
			await user.click(screen.getByRole('button', { name: 'Validate' }));
			await user.type(input, '0');
			release({
				data: { vat_id: 'DE123456789' },
				error: undefined,
				response: { status: 200 } as Response
			} as never);
			await waitFor(() =>
				expect(vi.mocked(sdk.userbillingGetBillingProfile).mock.calls.length).toBeGreaterThan(1)
			);
			await new Promise((r) => setTimeout(r, 30));
			expect(screen.getByLabelText('VAT ID')).toHaveValue('DE1234567890');
		});
	});
});
