import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { OrganizationComplianceSchema } from '$lib/api/generated/types.gen';
import CountryRulesCard from './CountryRulesCard.svelte';

function compliance(
	overrides: Partial<OrganizationComplianceSchema> = {}
): OrganizationComplianceSchema {
	return {
		country: 'DE',
		attendee_invoicing: 'allowed',
		online_payment: 'allowed',
		offline_payment: 'allowed',
		notices: [],
		...overrides
	};
}

describe('CountryRulesCard', () => {
	it('says everything is available for an unrestricted EU country', () => {
		render(CountryRulesCard, { props: { compliance: compliance() } });
		expect(screen.getByRole('heading', { name: 'Country rules' })).toBeInTheDocument();
		expect(
			screen.getByText('Your organization is set up for Germany. All Revel features are available.')
		).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Learn more/ })).toHaveAttribute(
			'href',
			'https://docs.letsrevel.io/compliance/eu/de/'
		);
	});

	it('lists one bullet per restriction', () => {
		render(CountryRulesCard, {
			props: { compliance: compliance({ country: 'IT', online_payment: 'blocked' }) }
		});
		expect(screen.getByText(/Some features work differently here/)).toBeInTheDocument();
		expect(screen.getAllByRole('listitem')).toHaveLength(1);
	});

	it('asks for a VAT ID or city when the country is unknown', () => {
		render(CountryRulesCard, { props: { compliance: compliance({ country: '' }) } });
		expect(screen.getByText(/We don't know which country/)).toBeInTheDocument();
	});

	it('shows the out-of-scope copy outside the EU', () => {
		render(CountryRulesCard, { props: { compliance: compliance({ country: 'US' }) } });
		expect(screen.getByText(/only checks tax rules for EU countries/)).toBeInTheDocument();
	});

	it('renders every org notice as a status, whatever its topic', () => {
		render(CountryRulesCard, {
			props: {
				compliance: compliance({
					country: 'PL',
					attendee_invoicing: 'blocked_for_business_buyers',
					notices: [{ key: 'pl_kasa_fiskalna', applies_to: 'ticket_sales', message: 'Kasa notice' }]
				})
			}
		});
		const notice = screen.getByTestId('compliance-notice-pl_kasa_fiskalna');
		expect(notice).toHaveAttribute('role', 'status');
		expect(notice).toHaveTextContent('Kasa notice');
	});
});
