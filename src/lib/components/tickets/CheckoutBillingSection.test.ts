import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import CheckoutBillingSection from './CheckoutBillingSection.svelte';

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
	return render(CheckoutBillingSection, {
		props: { ...defaultProps, ...props },
		context: new Map([['$$_queryClient', queryClient]])
	});
}

describe('CheckoutBillingSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('collapsed state', () => {
		it('renders the toggle button with correct label', () => {
			renderWithQueryClient();
			expect(screen.getByRole('button', { name: /Request Invoice/i })).toBeInTheDocument();
		});

		it('toggle button has aria-expanded=false when collapsed', () => {
			renderWithQueryClient();
			const button = screen.getByRole('button', { name: /Request Invoice/i });
			expect(button).toHaveAttribute('aria-expanded', 'false');
		});

		it('does not show form fields when collapsed', () => {
			renderWithQueryClient();
			expect(screen.queryByLabelText(/Legal Name/i)).not.toBeInTheDocument();
		});

		it('toggle button is keyboard accessible', () => {
			renderWithQueryClient();
			const button = screen.getByRole('button', { name: /Request Invoice/i });
			expect(button).toBeInTheDocument();
			expect(button.tagName).toBe('BUTTON');
			expect(button).not.toBeDisabled();
		});
	});

	describe('expanded state', () => {
		it('shows form fields after clicking toggle', async () => {
			renderWithQueryClient();
			const button = screen.getByRole('button', { name: /Request Invoice/i });
			await fireEvent.click(button);

			expect(screen.getByLabelText(/Legal Name/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Billing Address/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Country Code/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/Billing Email/i)).toBeInTheDocument();
			expect(screen.getByLabelText(/VAT ID/i)).toBeInTheDocument();
		});

		it('toggle button has aria-expanded=true when open', async () => {
			renderWithQueryClient();
			const button = screen.getByRole('button', { name: /Request Invoice/i });
			await fireEvent.click(button);
			expect(button).toHaveAttribute('aria-expanded', 'true');
		});

		it('shows description text when expanded', async () => {
			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('button', { name: /Request Invoice/i }));
			expect(
				screen.getByText(/Provide your billing details to receive an invoice/i)
			).toBeInTheDocument();
		});

		it('does not show save to profile checkbox for unauthenticated users', async () => {
			renderWithQueryClient({ isAuthenticated: false });
			await fireEvent.click(screen.getByRole('button', { name: /Request Invoice/i }));
			expect(screen.queryByText(/Save billing info to my profile/i)).not.toBeInTheDocument();
		});

		it('shows save to profile checkbox for authenticated users', async () => {
			renderWithQueryClient({ isAuthenticated: true, authToken: 'token-xyz' });
			await fireEvent.click(screen.getByRole('button', { name: /Request Invoice/i }));
			expect(screen.getByText(/Save billing info to my profile/i)).toBeInTheDocument();
		});

		it('billing name field is marked as required', async () => {
			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('button', { name: /Request Invoice/i }));
			const nameInput = screen.getByLabelText(/Legal Name/i);
			expect(nameInput).toHaveAttribute('aria-required', 'true');
		});

		it('collapses section on second click', async () => {
			renderWithQueryClient();
			const button = screen.getByRole('button', { name: /Request Invoice/i });
			await fireEvent.click(button);
			expect(screen.getByLabelText(/Legal Name/i)).toBeInTheDocument();
			await fireEvent.click(button);
			expect(screen.queryByLabelText(/Legal Name/i)).not.toBeInTheDocument();
		});
	});

	describe('VAT preview', () => {
		it('shows VAT preview section when VAT ID has a value', async () => {
			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('button', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'ATU12345678' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText('VAT Preview')).toBeInTheDocument();
			});
		});

		it('shows VAT preview totals after fetch', async () => {
			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('button', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'ATU12345678' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText('Total Net')).toBeInTheDocument();
				expect(screen.getByText('Total VAT')).toBeInTheDocument();
				expect(screen.getByText('Total')).toBeInTheDocument();
			});
		});

		it('shows VAT ID valid status when validation succeeds', async () => {
			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('button', { name: /Request Invoice/i }));

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
			await fireEvent.click(screen.getByRole('button', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'DE123456789' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText(/Reverse charge applies — no VAT charged/i)).toBeInTheDocument();
			});
		});

		it('shows error message when VAT preview fails', async () => {
			const { eventpublicticketsVatPreview } = await import('$lib/api/generated/sdk.gen');
			vi.mocked(eventpublicticketsVatPreview).mockResolvedValueOnce({
				data: null,
				error: { detail: 'Server error' },
				response: { status: 500 } as Response
			});

			renderWithQueryClient();
			await fireEvent.click(screen.getByRole('button', { name: /Request Invoice/i }));

			const vatInput = screen.getByLabelText(/VAT ID/i);
			await fireEvent.input(vatInput, { target: { value: 'INVALID' } });
			await fireEvent.blur(vatInput);

			await waitFor(() => {
				expect(screen.getByText('Could not calculate VAT preview')).toBeInTheDocument();
			});
		});
	});

	describe('disabled state', () => {
		it('disables toggle button when disabled prop is true', () => {
			renderWithQueryClient({ disabled: true });
			const button = screen.getByRole('button', { name: /Request Invoice/i });
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
			await fireEvent.click(screen.getByRole('button', { name: /Request Invoice/i }));

			await waitFor(() => {
				const nameInput = screen.getByLabelText(/Legal Name/i) as HTMLInputElement;
				expect(nameInput.value).toBe('Acme s.r.l.');
			});
		});
	});
});
