import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PurchaseErrorAlert from './PurchaseErrorAlert.svelte';
import type { EventUserEligibility } from '$lib/api/generated/types.gen';
import type { TierSchemaWithId } from '$lib/types/tickets';
import * as m from '$lib/paraglide/messages.js';
import {
	GuestAccountRequiredError,
	GuestCartTooLargeError
} from '../events/guest-cart-checkout-controller.svelte';

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

	// #853 PR 4: a guest checkout refused because the next step (e.g.
	// become_member) has no guest-compatible path — GuestAccountRequiredError,
	// not a membership-tier gate, so it gets its own CTA pair.
	describe('GuestAccountRequiredError', () => {
		const accountRequiredError = new GuestAccountRequiredError('Please complete a questionnaire.', {
			cause: { next_step: 'complete_questionnaire' }
		});

		it('renders login and create-account links instead of the membership CTA', () => {
			renderAlert({ error: accountRequiredError, tier: ungatedTier });
			expect(screen.getByText('Please complete a questionnaire.')).toBeInTheDocument();
			expect(
				screen.getByRole('link', { name: m['guestTicketDialog.logIn']() })
			).toBeInTheDocument();
			expect(
				screen.getByRole('link', { name: m['guestTicketDialog.createAnAccount']() })
			).toBeInTheDocument();
			expect(
				screen.queryByRole('link', { name: m['membershipPlans.viewMembership']() })
			).toBeNull();
		});

		// `returnUrl` is the param the login/register server actions actually read
		// (`safeReturnUrl`) — the old `redirect` param was silently ignored and
		// stranded the buyer on the dashboard after signing in (issue #912).
		it('points the login/register links at the current path with a returnUrl param', () => {
			renderAlert({ error: accountRequiredError, tier: ungatedTier });
			const loginLink = screen.getByRole('link', { name: m['guestTicketDialog.logIn']() });
			const registerLink = screen.getByRole('link', {
				name: m['guestTicketDialog.createAnAccount']()
			});
			expect(loginLink).toHaveAttribute('href', `/login?returnUrl=${encodeURIComponent('/')}`);
			expect(registerLink).toHaveAttribute(
				'href',
				`/register?returnUrl=${encodeURIComponent('/')}`
			);
		});

		// Backend #952 / issue #912: the guest_account_exists refusal knows which
		// email owns the account, so the sign-in form gets it prefilled.
		it('prefills the sign-in link with the email the error carries', () => {
			const withEmail = new GuestAccountRequiredError('An account with this email exists.', {
				cause: { detail: 'An account with this email exists.', code: 'guest_account_exists' },
				email: 'guest@example.com'
			});
			renderAlert({ error: withEmail, tier: ungatedTier });
			const loginLink = screen.getByRole('link', { name: m['guestTicketDialog.logIn']() });
			expect(loginLink).toHaveAttribute(
				'href',
				`/login?returnUrl=${encodeURIComponent('/')}&email=${encodeURIComponent('guest@example.com')}`
			);
		});

		it('shows no account-required CTA for an unrelated purchase failure', () => {
			renderAlert({ error: { detail: 'Sold out.' } });
			expect(screen.queryByRole('link', { name: m['guestTicketDialog.logIn']() })).toBeNull();
		});
	});

	// Issue #912: guest_cart_too_large — the emailed confirmation link cannot
	// carry a cart this big. Two ways out, both CTAs: sign in (no link-size
	// ceiling) or split the purchase (close the sheet, cart intact).
	describe('GuestCartTooLargeError', () => {
		const tooLargeError = new GuestCartTooLargeError(m['cart.guestCartTooLarge'](), {
			cause: { detail: 'backend copy', code: 'guest_cart_too_large' },
			email: 'guest@example.com'
		});

		it('renders the localized explanation with a prefilled log-in link and a split-purchase button', async () => {
			const onSplitPurchase = vi.fn();
			renderAlert({ error: tooLargeError, tier: ungatedTier, onSplitPurchase });
			expect(screen.getByText(m['cart.guestCartTooLarge']())).toBeInTheDocument();
			const loginLink = screen.getByRole('link', { name: m['guestTicketDialog.logIn']() });
			expect(loginLink).toHaveAttribute(
				'href',
				`/login?returnUrl=${encodeURIComponent('/')}&email=${encodeURIComponent('guest@example.com')}`
			);
			const splitButton = screen.getByRole('button', { name: m['cart.splitPurchase']() });
			await userEvent.click(splitButton);
			expect(onSplitPurchase).toHaveBeenCalledTimes(1);
		});

		it('omits the split-purchase button when no handler is provided', () => {
			renderAlert({ error: tooLargeError, tier: ungatedTier });
			expect(screen.queryByRole('button', { name: m['cart.splitPurchase']() })).toBeNull();
			expect(
				screen.getByRole('link', { name: m['guestTicketDialog.logIn']() })
			).toBeInTheDocument();
		});

		it('offers no create-account link — the account that helps here may already exist', () => {
			renderAlert({ error: tooLargeError, tier: ungatedTier, onSplitPurchase: vi.fn() });
			expect(
				screen.queryByRole('link', { name: m['guestTicketDialog.createAnAccount']() })
			).toBeNull();
		});
	});
});
