import { render, screen, waitFor, within } from '@testing-library/svelte';
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

import SmallBusinessSchemeSection from './SmallBusinessSchemeSection.svelte';

function info(extra: Record<string, unknown> = {}) {
	return {
		vat_country_code: 'DE',
		vat_id: 'DE123456789',
		vat_id_validated: true,
		vat_rate: '0.00',
		billing_country_code: '',
		small_business_scheme: 'none',
		tiers_charging_vat: [],
		tax_registration_number: '',
		compliance: { country: 'DE' },
		...extra
	};
}

function renderIt(extra: Record<string, unknown> = {}) {
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: SmallBusinessSchemeSection,
			componentProps: { slug: 'acme', accessToken: 'tok', info: info(extra) }
		}
	});
}

const save = () => screen.getByRole('button', { name: /save small-business/i });

beforeEach(() => update.mockReset().mockResolvedValue({ data: {} }));

describe('SmallBusinessSchemeSection', () => {
	it('explains the scheme is unavailable outside DE/AT', () => {
		renderIt({ vat_country_code: 'IT', vat_id: '', compliance: { country: 'IT' } });
		expect(screen.getByTestId('small-business-unavailable')).toBeInTheDocument();
		expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
	});

	it('asks to set a country when undeclared', () => {
		renderIt({ vat_country_code: '', vat_id: '', compliance: { country: '' } });
		expect(screen.getByTestId('small-business-unavailable')).toHaveTextContent(
			/Set the VAT country/
		);
	});

	it('shows the DE note read-only with a VAT ID link once enabled', async () => {
		renderIt();
		await userEvent.click(screen.getByRole('checkbox', { name: /§ 19 UStG/ }));
		expect(screen.getByTestId('small-business-note')).toHaveTextContent(
			'Steuerbefreit gemäß § 19 UStG (Kleinunternehmerregelung)'
		);
		expect(screen.getByTestId('small-business-note')).toHaveAttribute('lang', 'de');
		expect(screen.getByRole('link', { name: /VAT ID section/ })).toHaveAttribute(
			'href',
			'#vat-id-section'
		);
		expect(screen.getByLabelText(/Steuernummer/)).toBeInTheDocument();
		expect(save()).toBeEnabled();
	});

	it('blocks DE saving without a validated VAT ID', async () => {
		renderIt({ vat_id_validated: false });
		await userEvent.click(screen.getByRole('checkbox', { name: /§ 19 UStG/ }));
		expect(save()).toBeDisabled();
		expect(screen.getByTestId('small-business-blockers')).toHaveTextContent(/VIES-validated/);
	});

	it('requires and validates the AT tax number, flagging errors on blur', async () => {
		renderIt({
			vat_country_code: 'AT',
			vat_id: '',
			vat_id_validated: false,
			compliance: { country: 'AT' }
		});
		await userEvent.click(screen.getByRole('checkbox', { name: /§ 6 Abs\. 1 Z 27/ }));
		expect(save()).toBeDisabled();
		const input = screen.getByLabelText(/Steuernummer/);
		await userEvent.type(input, '123');
		await userEvent.tab();
		expect(input).toHaveAttribute('aria-invalid', 'true');
		expect(input.getAttribute('aria-describedby')).toContain('small-business-tax-number-error');
		await userEvent.clear(input);
		await userEvent.type(input, '12-345/6789');
		expect(save()).toBeEnabled();
	});

	it('requires confirming the 0 % default rate and sends vat_rate 0', async () => {
		renderIt({ vat_rate: '19.00' });
		await userEvent.click(screen.getByRole('checkbox', { name: /§ 19 UStG/ }));
		expect(screen.getByTestId('small-business-vat-rate')).toHaveTextContent('19 %');
		expect(save()).toBeDisabled();
		await userEvent.click(screen.getByRole('checkbox', { name: /Set my default VAT rate to 0/ }));
		await userEvent.click(save());
		await waitFor(() => expect(update).toHaveBeenCalled());
		expect(update.mock.calls[0][0].body).toEqual({
			small_business_scheme: 'de_19',
			tax_registration_number: '',
			vat_rate: 0
		});
	});

	describe('tiers still charging VAT', () => {
		const tiers = [
			{
				event_id: 'e1',
				event_name: 'Summer Fest',
				tier_id: 't1',
				tier_name: 'General',
				vat_rate: '19.00'
			},
			{
				event_id: 'e2',
				event_name: 'Autumn Gig',
				tier_id: 't2',
				tier_name: 'VIP',
				vat_rate: '7.00'
			}
		];

		it('lists the tiers with links and blocks saving while declaring', async () => {
			renderIt({ tiers_charging_vat: tiers });
			expect(screen.queryByTestId('small-business-tiers-charging-vat')).not.toBeInTheDocument();
			await userEvent.click(screen.getByRole('checkbox', { name: /§ 19 UStG/ }));
			const box = screen.getByTestId('small-business-tiers-charging-vat');
			expect(box).toHaveTextContent(/still charge VAT/);
			const links = within(box).getAllByRole('link');
			expect(links).toHaveLength(2);
			expect(links[0]).toHaveAttribute('href', '/org/acme/admin/events/e1/edit?tab=ticketing');
			expect(links[1]).toHaveAttribute('href', '/org/acme/admin/events/e2/edit?tab=ticketing');
			expect(links[0]).toHaveTextContent('Summer Fest, General: 19 % VAT');
			expect(save()).toBeDisabled();
			expect(screen.getByTestId('small-business-blockers')).toHaveTextContent(
				/Set the ticket tiers listed above to 0 %/
			);
		});

		it('shows nothing for an empty list', async () => {
			renderIt({ tiers_charging_vat: [] });
			await userEvent.click(screen.getByRole('checkbox', { name: /§ 19 UStG/ }));
			expect(screen.queryByTestId('small-business-tiers-charging-vat')).not.toBeInTheDocument();
			expect(save()).toBeEnabled();
		});

		it('never shows for an already declared scheme', () => {
			renderIt({ small_business_scheme: 'de_19', tiers_charging_vat: tiers });
			expect(screen.queryByTestId('small-business-tiers-charging-vat')).not.toBeInTheDocument();
		});
	});

	it('turning off sends only scheme none', async () => {
		renderIt({ small_business_scheme: 'de_19', tax_registration_number: '12/345/67890' });
		await userEvent.click(screen.getByRole('checkbox', { name: /§ 19 UStG/ }));
		await userEvent.click(save());
		await waitFor(() => expect(update).toHaveBeenCalled());
		expect(update.mock.calls[0][0].body).toEqual({ small_business_scheme: 'none' });
	});

	it('lets a mismatched legacy scheme be removed', async () => {
		renderIt({
			small_business_scheme: 'de_19',
			vat_country_code: 'IT',
			vat_id: '',
			compliance: { country: 'IT' }
		});
		expect(screen.getByTestId('small-business-mismatch')).toBeInTheDocument();
		expect(save()).toBeDisabled();
		await userEvent.click(screen.getByRole('checkbox'));
		expect(save()).toBeEnabled();
	});

	it('does not require the AT tax number when the VAT ID is validated', async () => {
		renderIt({
			vat_country_code: 'AT',
			vat_id: 'ATU12345678',
			vat_id_validated: true,
			compliance: { country: 'AT' }
		});
		await userEvent.click(screen.getByRole('checkbox', { name: /§ 6 Abs\. 1 Z 27/ }));
		expect(screen.getByText('(optional)')).toBeInTheDocument();
		expect(save()).toBeEnabled();
		await userEvent.type(screen.getByLabelText(/Steuernummer/), '123');
		expect(save()).toBeDisabled();
	});

	it('offers a new default VAT rate when removing and sends it with scheme none', async () => {
		renderIt({ small_business_scheme: 'de_19' });
		expect(screen.queryByLabelText(/New default VAT rate/)).not.toBeInTheDocument();
		await userEvent.click(screen.getByRole('checkbox', { name: /§ 19 UStG/ }));
		const rate = screen.getByLabelText(/New default VAT rate/);
		await userEvent.type(rate, '150');
		expect(save()).toBeDisabled();
		await userEvent.clear(rate);
		await userEvent.type(rate, '19,5');
		expect(rate).toHaveValue('19.5');
		await userEvent.click(save());
		await waitFor(() => expect(update).toHaveBeenCalled());
		expect(update.mock.calls[0][0].body).toEqual({
			small_business_scheme: 'none',
			vat_rate: 19.5
		});
	});

	it('starts clean for a mismatched legacy scheme and only allows removing it', async () => {
		renderIt({
			small_business_scheme: 'de_19',
			vat_country_code: 'AT',
			vat_id: '',
			compliance: { country: 'AT' }
		});
		const box = screen.getByRole('checkbox', { name: /§ 19 UStG/ });
		expect(box).toBeChecked();
		expect(save()).toBeDisabled();
		await userEvent.click(box);
		await userEvent.click(save());
		await waitFor(() => expect(update).toHaveBeenCalled());
		expect(update.mock.calls[0][0].body).toEqual({ small_business_scheme: 'none' });
	});

	it('keeps a backend refusal inline in an alert', async () => {
		update.mockResolvedValue({ error: { detail: 'Some ticket tiers still charge VAT.' } });
		renderIt();
		await userEvent.click(screen.getByRole('checkbox', { name: /§ 19 UStG/ }));
		await userEvent.click(save());
		const alert = await screen.findByTestId('small-business-error');
		expect(alert).toHaveAttribute('role', 'alert');
		expect(alert).toHaveTextContent('Some ticket tiers still charge VAT.');
		await userEvent.type(screen.getByLabelText(/Steuernummer/), '1');
		expect(screen.queryByTestId('small-business-error')).not.toBeInTheDocument();
	});
});
