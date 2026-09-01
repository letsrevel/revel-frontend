import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import CheckoutBillingSection from './CheckoutBillingSection.svelte';
import CheckoutBillingSectionTestHost from './CheckoutBillingSectionTestHost.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';

// Mock API functions
vi.mock('$lib/api/generated/sdk.gen', () => ({
	userbillingGetBillingProfile: vi
		.fn()
		.mockResolvedValue({ data: null, response: { status: 404 }, error: null }),
	eventpublicticketsVatPreview: vi.fn().mockResolvedValue({
		data: {
			vat_id_valid: true,
			vat_id_validation_error: null,
			reverse_charge: false,
			line_items: [
				{
					tier_name: 'General Admission',
					ticket_count: 2,
					unit_price_gross: '25.00',
					unit_price_net: '20.83',
					unit_vat: '4.17',
					vat_rate: '20.00',
					line_net: '41.67',
					line_vat: '8.33',
					line_gross: '50.00'
				}
			],
			total_net: '41.67',
			total_vat: '8.33',
			total_gross: '50.00',
			currency: 'EUR'
		},
		error: null
	})
}));

// Mock paraglide messages
vi.mock('$lib/paraglide/messages.js', () => ({
	'checkout.billing.requestInvoice': () => 'Request Invoice',
	'checkout.billing.requestInvoiceDescription': () =>
		'Provide your billing details to receive an invoice.',
	'checkout.billing.billingName': () => 'Legal Name',
	'checkout.billing.required': () => 'required',
	'checkout.billing.billingNamePlaceholder': () => 'Full legal name or company name',
	'checkout.billing.billingAddress': () => 'Billing Address',
	'checkout.billing.billingAddressPlaceholder': () => 'Street, city, postal code',
	'checkout.billing.vatCountryCode': () => 'Country Code',
	'checkout.billing.vatCountryCodePlaceholder': () => 'e.g. AT, DE, IT',
	'checkout.billing.billingEmail': () => 'Billing Email',
	'checkout.billing.billingEmailPlaceholder': () => 'Invoice will be sent here',
	'checkout.billing.vatId': () => 'VAT ID (optional)',
	'checkout.billing.vatIdPlaceholder': () => 'e.g. ATU12345678',
	'checkout.billing.saveToProfile': () => 'Save billing info to my profile',
	'checkout.billing.vatPreview': () => 'VAT Preview',
	'checkout.billing.vatPreviewLoading': () => 'Calculating VAT...',
	'checkout.billing.vatPreviewError': () => 'Could not calculate VAT preview',
	'checkout.billing.vatIdValid': () => 'VAT ID valid',
	'checkout.billing.vatIdInvalid': () => 'VAT ID could not be validated',
	'checkout.billing.reverseCharge': () => 'Reverse charge applies — no VAT charged',
	'checkout.billing.virtualB2cDisclaimer': () =>
		'VAT charged at the organizer’s rate; your country’s rate may apply',
	'checkout.billing.lineItem': () => 'Item',
	'checkout.billing.lineNet': () => 'Net',
	'checkout.billing.lineVat': () => 'VAT',
	'checkout.billing.lineGross': () => 'Gross',
	'checkout.billing.totalNet': () => 'Total Net',
	'checkout.billing.totalVat': () => 'Total VAT',
	'checkout.billing.totalGross': () => 'Total',
	'checkout.billing.billingNameRequired': () => 'Legal name is required for invoice'
}));

const defaultProps = {
	eventId: 'event-123',
	tierId: 'tier-456',
	tierName: 'General Admission',
	quantity: 2,
	currency: 'EUR',
	price: '25.00',
	isPwyc: false,
	isAuthenticated: false
};

function renderWithQueryClient(props: Record<string, unknown> = {}) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } }
	});
	return render(QueryClientTestWrapper, {
		props: {
			client: queryClient,
			component: CheckoutBillingSection,
			componentProps: { ...defaultProps, ...props }
		}
	});
}

// For effect-tracking tests: testing-library's rerender invalidates EVERY
// prop read (its props proxy is $state.raw-coarse), masking untracked-prop
// bugs — the stateful host mutates its own $state via exported setters
// instead, so only genuinely tracked reads re-fire effects.
function renderHost(props: Record<string, unknown> = {}) {
	return render(CheckoutBillingSectionTestHost, { props });
}

describe('CheckoutBillingSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('collapsed state', () => {
		it('renders the toggle checkbox with correct label', () => {
			renderWithQueryClient();
			expect(screen.getByRole('checkbox', { name: /Request Invoice/i })).toBeInTheDocument();
		});

		it('toggle checkbox is unchecked when collapsed', () => {
			renderWithQueryClient();
			const button = screen.getByRole('checkbox', { name: /Request Invoice/i });
			expect(button).toHaveAttribute('aria-checked', 'false');
		});

		it('does not show form fields when collapsed', () => {
			renderWithQueryClient();
			expect(screen.queryByLabelText(/Legal Name/i)).not.toBeInTheDocument();
		});

		it('toggle checkbox is keyboard accessible', () => {
			renderWithQueryClient();
			const button = screen.getByRole('checkbox', { name: /Request Invoice/i });
			expect(button).toBeInTheDocument();
			expect(button.tagName).toBe('BUTTON');
			expect(button).not.toBeDisabled();
		});
	});

	describe('expanded state', () => {
		it('shows form fields after clicking toggle', async () => {
			renderWithQueryClient();
			const button = screen.getByRole('checkbox', { name: /Request Invoice/i });
			await fireEvent.click(button);

			expect(screen.getByLabelText(/Legal Name/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Billing Address/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Country Code/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Billing Email/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/VAT ID/i)).toBeInTheDocument();
		});

		it('toggle checkbox is checked when open', async () => {
			renderWithQueryClient();
			const button = screen.getByRole('checkbox', { name: /Request Invoice/i });
			await fireEvent.click(button);
			expect(button).toHaveAttribute('aria-checked', 'true');
		});

		it('shows description text when expanded', async () => {
			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));
			expect(
				screen.getByText(/Provide your billing details to receive an invoice/i)
			).toBeInTheDocument();
		});

		it('does not show save to profile checkbox for unauthenticated users', async () => {
			renderWithQueryClient({ isAuthenticated: false });
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));
			expect(screen.queryByText(/Save billing info to my profile/i)).not.toBeInTheDocument();
		});

		it('shows save to profile checkbox for authenticated users', async () => {
			renderWithQueryClient({ isAuthenticated: true, authToken: 'token-xyz' });
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));
			expect(screen.getByText(/Save billing info to my profile/i)).toBeInTheDocument();
		});

		it('billing name field is marked as required', async () => {
			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));
			const nameInput = screen.getByLabelText(/Legal Name/i);
			expect(nameInput).toHaveAttribute('aria-required', 'true');
		});

		it('collapses section on second click', async () => {
			renderWithQueryClient();
			const button = screen.getByRole('checkbox', { name: /Request Invoice/i });
			await fireEvent.click(button);
			expect(screen.getByLabelText(/Legal Name/i)).toBeInTheDocument();
			await fireEvent.click(button);
			expect(screen.queryByLabelText(/Legal Name/i)).not.toBeInTheDocument();
		});
	});

	describe('VAT preview', () => {
		it('shows VAT preview section when VAT ID has a value', async () => {
			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'ATU12345678' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText('VAT Preview')).toBeInTheDocument();
			});
		});

		it('shows VAT preview totals after fetch', async () => {
			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'ATU12345678' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText('Total Net')).toBeInTheDocument();
				expect(screen.getByText('Total VAT')).toBeInTheDocument();
				expect(screen.getByText('Total')).toBeInTheDocument();
			});
		});

		it('refreshes a visible preview when the applied discount code changes (#863 review)', async () => {
			const { eventpublicticketsVatPreview } = await import('$lib/api/generated/sdk.gen');
			const { component } = renderHost();
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'ATU12345678' } });
			await fireEvent.blur(vatInput);
			await waitFor(() => expect(screen.getByText('Total Net')).toBeInTheDocument());
			expect(vi.mocked(eventpublicticketsVatPreview)).toHaveBeenCalledTimes(1);

			// The discount changes the taxable amount — a visible preview must
			// refetch, not keep quoting the pre-discount numbers.
			component.setDiscountCode('SAVE10');
			await waitFor(() => expect(vi.mocked(eventpublicticketsVatPreview)).toHaveBeenCalledTimes(2));
		});

		it('refreshes a visible preview when the PWYC amount changes (#863 review)', async () => {
			const { eventpublicticketsVatPreview } = await import('$lib/api/generated/sdk.gen');
			const items = [{ tier_id: 'tier-456', count: 2 }];
			const { component } = renderHost({
				initialItems: items,
				initialPwycAmountOverride: '10.00'
			});
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'ATU12345678' } });
			await fireEvent.blur(vatInput);
			await waitFor(() => expect(screen.getByText('Total Net')).toBeInTheDocument());
			expect(vi.mocked(eventpublicticketsVatPreview)).toHaveBeenCalledTimes(1);

			component.setPwycAmountOverride('25.00');
			await waitFor(() => expect(vi.mocked(eventpublicticketsVatPreview)).toHaveBeenCalledTimes(2));
		});

		it('shows VAT ID valid status when validation succeeds', async () => {
			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'ATU12345678' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText('VAT ID valid')).toBeInTheDocument();
			});
		});

		it('shows reverse charge banner when applicable', async () => {
			const { eventpublicticketsVatPreview } = await import('$lib/api/generated/sdk.gen');
			vi.mocked(eventpublicticketsVatPreview).mockResolvedValueOnce({
				data: {
					vat_id_valid: true,
					vat_id_validation_error: null,
					reverse_charge: true,
					line_items: [],
					total_net: '50.00',
					total_vat: '0.00',
					total_gross: '50.00',
					currency: 'EUR'
				},
				error: null,
				response: { status: 200 } as Response
			});

			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'DE123456789' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText(/Reverse charge applies — no VAT charged/i)).toBeInTheDocument();
			});
			// BE #868/#869: reverse charge only ever arrives for virtual events, but
			// the FE renders whatever the backend decides — no client-side gating.
			expect(screen.queryByText(/VAT charged at the organizer’s rate/i)).not.toBeInTheDocument();
		});

		it('shows the virtual B2C disclaimer when the preview flags it (#830)', async () => {
			const { eventpublicticketsVatPreview } = await import('$lib/api/generated/sdk.gen');
			vi.mocked(eventpublicticketsVatPreview).mockResolvedValueOnce({
				data: {
					vat_id_valid: null,
					vat_id_validation_error: null,
					reverse_charge: false,
					virtual_b2c_disclaimer: true,
					line_items: [],
					total_net: '41.67',
					total_vat: '8.33',
					total_gross: '50.00',
					currency: 'EUR'
				},
				error: null,
				response: { status: 200 } as Response
			});

			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'FR123456789' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText(/VAT charged at the organizer’s rate/i)).toBeInTheDocument();
			});
			expect(screen.queryByText(/Reverse charge applies/i)).not.toBeInTheDocument();
		});

		it('renders only the reverse-charge banner if the backend ever sent both flags', async () => {
			// The flags are mutually exclusive by construction (reverse charge
			// requires a validated VAT ID, the disclaimer requires the opposite);
			// this pins the defensive else-if should that contract ever break.
			const { eventpublicticketsVatPreview } = await import('$lib/api/generated/sdk.gen');
			vi.mocked(eventpublicticketsVatPreview).mockResolvedValueOnce({
				data: {
					vat_id_valid: true,
					vat_id_validation_error: null,
					reverse_charge: true,
					virtual_b2c_disclaimer: true,
					line_items: [],
					total_net: '50.00',
					total_vat: '0.00',
					total_gross: '50.00',
					currency: 'EUR'
				},
				error: null,
				response: { status: 200 } as Response
			});

			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'DE123456789' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText(/Reverse charge applies/i)).toBeInTheDocument();
			});
			expect(screen.queryByText(/VAT charged at the organizer’s rate/i)).not.toBeInTheDocument();
		});

		it('shows neither banner for a default physical-event preview', async () => {
			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'ATU12345678' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText('Total Net')).toBeInTheDocument();
			});
			expect(screen.queryByText(/Reverse charge applies/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/VAT charged at the organizer’s rate/i)).not.toBeInTheDocument();
		});

		it('shows error message when VAT preview fails', async () => {
			const { eventpublicticketsVatPreview } = await import('$lib/api/generated/sdk.gen');
			vi.mocked(eventpublicticketsVatPreview).mockResolvedValueOnce({
				data: null,
				error: { detail: 'Server error' },
				response: { status: 500 } as Response
			});

			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'INVALID' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText('Could not calculate VAT preview')).toBeInTheDocument();
			});
		});
	});

	describe('disabled state', () => {
		it('disables toggle checkbox when disabled prop is true', () => {
			renderWithQueryClient({ disabled: true });
			const button = screen.getByRole('checkbox', { name: /Request Invoice/i });
			expect(button).toBeDisabled();
		});
	});

	describe('pre-fill from billing profile', () => {
		it('pre-fills form when authenticated user has billing profile', async () => {
			const { userbillingGetBillingProfile } = await import('$lib/api/generated/sdk.gen');
			vi.mocked(userbillingGetBillingProfile).mockResolvedValueOnce({
				data: {
					id: '1',
					billing_name: 'Acme s.r.l.',
					billing_address: 'Via Roma 1, Milano',
					vat_country_code: 'IT',
					billing_email: 'billing@acme.it',
					vat_id: 'IT01234567890',
					vat_id_validated: true,
					self_billing_agreed: false
				},
				response: { status: 200 } as Response,
				error: null
			});

			renderWithQueryClient({ isAuthenticated: true, authToken: 'token-xyz' });
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			await waitFor(() => {
				const nameInput = screen.getByLabelText(/Legal Name/i) as HTMLInputElement;
				expect(nameInput.value).toBe('Acme s.r.l.');
			});
		});
	});

	// A user who never saved billing details gets a 404 from GET /api/me/billing.
	// That is an empty state, not a failure (#817).
	describe('billing profile 404 (nothing saved yet)', () => {
		function mock404(getBillingProfile: ReturnType<typeof vi.fn>) {
			getBillingProfile.mockResolvedValue({
				data: undefined,
				error: { detail: 'Not found' },
				response: { status: 404 } as Response
			});
		}

		it('does not request the billing profile until the invoice section is opened', async () => {
			const { userbillingGetBillingProfile } = await import('$lib/api/generated/sdk.gen');
			mock404(vi.mocked(userbillingGetBillingProfile));

			renderWithQueryClient({ isAuthenticated: true, authToken: 'token-xyz' });

			// Collapsed: the profile is only ever read by the prefill, so nothing is fetched.
			await waitFor(() => {
				expect(userbillingGetBillingProfile).not.toHaveBeenCalled();
			});

			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));
			await waitFor(() => {
				expect(userbillingGetBillingProfile).toHaveBeenCalledTimes(1);
			});
		});

		it('resolves to an empty profile without erroring or logging', async () => {
			const { userbillingGetBillingProfile } = await import('$lib/api/generated/sdk.gen');
			mock404(vi.mocked(userbillingGetBillingProfile));
			const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

			renderWithQueryClient({ isAuthenticated: true, authToken: 'token-xyz' });
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			await waitFor(() => {
				expect(userbillingGetBillingProfile).toHaveBeenCalled();
			});

			// The form is simply blank — the 404 resolved to null, it did not throw.
			const nameInput = screen.getByLabelText(/Legal Name/i) as HTMLInputElement;
			expect(nameInput.value).toBe('');
			expect(consoleError).not.toHaveBeenCalled();
			consoleError.mockRestore();
		});

		it('treats the new 200 + null contract (BE #861) as the same empty state', async () => {
			const { userbillingGetBillingProfile } = await import('$lib/api/generated/sdk.gen');
			vi.mocked(userbillingGetBillingProfile).mockResolvedValue({
				data: null,
				error: undefined,
				response: { status: 200 } as Response
			} as never);

			const queryClient = new QueryClient({
				defaultOptions: { queries: { retry: false } }
			});
			render(QueryClientTestWrapper, {
				props: {
					client: queryClient,
					component: CheckoutBillingSection,
					componentProps: { ...defaultProps, isAuthenticated: true, authToken: 'token-xyz' }
				}
			});
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			// Settled query state, not just "the call happened": the 200+null body
			// must land as success/null (the same terminal state the 404 path
			// produces), with the form left blank.
			await waitFor(() => {
				expect(queryClient.getQueryState(['user-billing-profile'])?.status).toBe('success');
			});
			expect(queryClient.getQueryData(['user-billing-profile'])).toBeNull();
			const nameInput = screen.getByLabelText(/Legal Name/i) as HTMLInputElement;
			expect(nameInput.value).toBe('');
		});

		it('does not retry a 404, even under a retrying query client', async () => {
			const { userbillingGetBillingProfile } = await import('$lib/api/generated/sdk.gen');
			mock404(vi.mocked(userbillingGetBillingProfile));

			const queryClient = new QueryClient({
				defaultOptions: { queries: { retry: 3, retryDelay: 0 } }
			});
			render(QueryClientTestWrapper, {
				props: {
					client: queryClient,
					component: CheckoutBillingSection,
					componentProps: { ...defaultProps, isAuthenticated: true, authToken: 'token-xyz' }
				}
			});
			await fireEvent.click(screen.getByRole('checkbox', { name: /Request Invoice/i }));

			await waitFor(() => {
				expect(userbillingGetBillingProfile).toHaveBeenCalledTimes(1);
			});
			expect(queryClient.getQueryState(['user-billing-profile'])?.status).toBe('success');
			expect(queryClient.getQueryData(['user-billing-profile'])).toBeNull();
		});
	});
});
