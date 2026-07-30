import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import PurchaseErrorAlert from './PurchaseErrorAlert.svelte';
import type { EventUserEligibility } from '$lib/api/generated/types.gen';
import type { TierSchemaWithId } from '$lib/types/tickets';
import * as m from '$lib/paraglide/messages.js';

const EVENT_ID = '11111111-1111-1111-1111-111111111111';

/**
 * The 400 body a membership-tier-gated purchase is refused with (BE #807,
 * `batch_ticket_service/eligibility.py:90`). It has no `detail`, names no
 * required membership tier, and is byte-identical for a non-member and for a
 * member on the wrong tier — hence the tier names come off the ticket tier, and
 * the CTA points at the plans list rather than promising an upgrade.
 */
const membershipTierRefusal: EventUserEligibility = {
	allowed: false,
	event_id: EVENT_ID,
	reason: 'This ticket tier requires a specific membership tier.',
	reason_code: 'membership_tier_required',
	next_step: 'upgrade_membership'
};

/** What the checkout controller throws for that refusal: message + body as cause. */
const refusalError = new Error(m['eligibility.reason.membership_tier_required'](), {
	cause: membershipTierRefusal
});

const gatedTier: TierSchemaWithId = {
	id: 'tier-1',
	event_id: EVENT_ID,
	name: 'Gold Only',
	price: '0.00',
	currency: 'EUR',
	total_available: null,
	seat_assignment_mode: 'none',
	payment_method: 'free',
	restricted_to_membership_tiers: [
		{ id: 'mt-gold', name: 'Gold' },
		{ id: 'mt-platinum', name: 'Platinum' }
	]
};

const ungatedTier: TierSchemaWithId = { ...gatedTier, restricted_to_membership_tiers: [] };

function renderAlert(props: Record<string, unknown> = {}) {
	return render(PurchaseErrorAlert, {
		props: { error: null, tier: gatedTier, organizationSlug: 'acme', ...props }
	});
}

describe('PurchaseErrorAlert', () => {
	it('renders nothing without an error', () => {
		renderAlert();
		expect(screen.queryByText(m['ticketConfirmationDialog.unableToComplete']())).toBeNull();
	});

	it('renders the refusal copy, not the generic error', () => {
		renderAlert({ error: refusalError });
		expect(
			screen.getByText(m['eligibility.reason.membership_tier_required']())
		).toBeInTheDocument();
		expect(screen.queryByText(m['ticketConfirmationDialog.errorGeneric']())).toBeNull();
	});

	it('reads the refusal straight off a raw SDK envelope too', () => {
		renderAlert({ error: { response: { data: membershipTierRefusal } } });
		expect(
			screen.getByText(m['eligibility.reason.membership_tier_required']())
		).toBeInTheDocument();
	});

	it('names the membership tiers that would satisfy the gate', () => {
		renderAlert({ error: refusalError });
		expect(screen.getByTestId('required-membership-tiers')).toHaveTextContent(
			m['tierCardAdmin.requiresMembership']({ tiers: 'Gold, Platinum' })
		);
	});

	// The dedicated tier page since #720: the old `/org/acme#membership` fragment
	// pointed at a plan grid that no longer lives on the landing page.
	it("links at the organization's membership page", () => {
		renderAlert({ error: refusalError });
		const link = screen.getByRole('link', { name: m['membershipPlans.viewMembership']() });
		expect(link).toHaveAttribute('href', '/org/acme/membership');
	});

	it('omits the link when the organization slug is unknown', () => {
		renderAlert({ error: refusalError, organizationSlug: null });
		expect(
			screen.getByText(m['eligibility.reason.membership_tier_required']())
		).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: m['membershipPlans.viewMembership']() })).toBeNull();
	});

	it('still explains the refusal when the tier lists no restriction', () => {
		// Defensive: a stale tier payload can lack the list the gate was built from.
		// The sentence and the CTA must survive; only the tier names drop out.
		renderAlert({ error: refusalError, tier: ungatedTier });
		expect(screen.queryByTestId('required-membership-tiers')).toBeNull();
		expect(screen.getByRole('link', { name: m['membershipPlans.viewMembership']() })).toBeTruthy();
	});

	it('shows no membership CTA for an unrelated purchase failure', () => {
		renderAlert({ error: { detail: 'Sold out.' } });
		expect(screen.getByText('Sold out.')).toBeInTheDocument();
		expect(screen.queryByTestId('required-membership-tiers')).toBeNull();
		expect(screen.queryByRole('link', { name: m['membershipPlans.viewMembership']() })).toBeNull();
	});

	it('falls back to the generic message for an unreadable error', () => {
		renderAlert({ error: {} });
		expect(screen.getByText(m['ticketConfirmationDialog.errorGeneric']())).toBeInTheDocument();
	});
});
