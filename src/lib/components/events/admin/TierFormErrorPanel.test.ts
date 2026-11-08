import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import TierFormErrorPanel from './TierFormErrorPanel.svelte';

const base = {
	error: { detail: 'Something was refused' },
	saveStatus: 422,
	paymentMethod: 'online',
	organizationSlug: 'acme'
};

describe('TierFormErrorPanel location hint', () => {
	it('shows the country-rule hint for a plain 422 on an online tier', () => {
		render(TierFormErrorPanel, { props: base });
		expect(screen.getByText(m['compliance.tier.locationHint']())).toBeInTheDocument();
	});

	it('suppresses it when a 0% tier without an exemption reason is the likely cause', () => {
		render(TierFormErrorPanel, { props: { ...base, exemptionLikelyCause: true } });
		expect(screen.getByText('Something was refused')).toBeInTheDocument();
		expect(screen.queryByText(m['compliance.tier.locationHint']())).not.toBeInTheDocument();
	});
});

describe('TierFormErrorPanel inline fields', () => {
	it('does not repeat the excluded-tiers message that renders beside its picker', () => {
		render(TierFormErrorPanel, {
			props: {
				...base,
				error: {
					errors: {
						excluded_membership_tiers: ['Only for non-members tiers.'],
						name: ['Name taken.']
					}
				}
			}
		});
		expect(screen.queryByText(/Only for non-members tiers/)).not.toBeInTheDocument();
		expect(screen.getByText(/Name taken/)).toBeInTheDocument();
	});

	it('shows no field list when the only error is the inline one', () => {
		render(TierFormErrorPanel, {
			props: {
				...base,
				error: { errors: { excluded_membership_tiers: ['Only for non-members tiers.'] } }
			}
		});
		expect(screen.queryByText(/Only for non-members tiers/)).not.toBeInTheDocument();
		expect(screen.queryByRole('list')).not.toBeInTheDocument();
	});
});
