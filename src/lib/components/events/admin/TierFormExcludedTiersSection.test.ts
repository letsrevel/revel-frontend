import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import TierFormExcludedTiersSection from './TierFormExcludedTiersSection.svelte';
import * as m from '$lib/paraglide/messages.js';
import type { MembershipTierSchema } from '$lib/api/generated/types.gen';

const gold = { id: 'gold', name: 'Gold' } as MembershipTierSchema;

describe('TierFormExcludedTiersSection', () => {
	it('shows a loading state, not the "every member is excluded" copy, while tiers load', () => {
		render(TierFormExcludedTiersSection, {
			props: { membershipTiers: [], status: 'loading', selectedIds: [], isPending: false }
		});
		expect(screen.getByTestId('tier-excluded-loading')).toBeInTheDocument();
		expect(screen.queryByText(m['tierForm.excludedMembershipTiersNone']())).not.toBeInTheDocument();
	});

	it('shows a load error, not the "every member is excluded" copy, when the query failed', () => {
		render(TierFormExcludedTiersSection, {
			props: { membershipTiers: [], status: 'error', selectedIds: [], isPending: false }
		});
		expect(screen.getByTestId('tier-excluded-load-error')).toBeInTheDocument();
		expect(screen.queryByText(m['tierForm.excludedMembershipTiersNone']())).not.toBeInTheDocument();
	});

	it('shows the "no tiers" copy once loaded and genuinely empty', () => {
		render(TierFormExcludedTiersSection, {
			props: { membershipTiers: [], status: 'ready', selectedIds: [], isPending: false }
		});
		expect(screen.getByText(m['tierForm.excludedMembershipTiersNone']())).toBeInTheDocument();
	});

	it('renders a stored id missing from the list by its stored name, and lets it be unticked', async () => {
		render(TierFormExcludedTiersSection, {
			props: {
				membershipTiers: [gold],
				knownExcludedTiers: [{ id: 'gone', name: 'Retired VIP' } as MembershipTierSchema],
				selectedIds: ['gone'],
				isPending: false
			}
		});
		const box = screen.getByRole('checkbox', { name: 'Retired VIP' });
		expect(box).toBeChecked();
		await userEvent.click(box);
		expect(screen.queryByRole('checkbox', { name: 'Retired VIP' })).not.toBeInTheDocument();
	});

	it('falls back to a generic label when the stored name is unknown', () => {
		render(TierFormExcludedTiersSection, {
			props: { membershipTiers: [], selectedIds: ['gone'], isPending: false }
		});
		expect(
			screen.getByRole('checkbox', { name: m['tierForm.excludedMembershipTierUnavailable']() })
		).toBeChecked();
	});
});
