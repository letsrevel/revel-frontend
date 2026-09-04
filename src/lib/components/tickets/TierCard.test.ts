import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import TierCard from './TierCard.svelte';
import type { TierSchemaWithId } from '$lib/types/tickets';
import type { EventTokenSchema, TicketTierSchema } from '$lib/api/generated/types.gen';

function makeTier(overrides: Partial<TierSchemaWithId> = {}): TierSchemaWithId {
	return {
		id: 'tier-1',
		event_id: 'event-1',
		name: 'General Admission',
		description: null,
		price: '0',
		currency: 'EUR',
		payment_method: 'free',
		price_type: 'fixed',
		total_available: null,
		can_purchase: true,
		...overrides
	} as TierSchemaWithId;
}

function renderCard(tier: TierSchemaWithId, capacityDisclosed?: boolean) {
	render(TierCard, {
		props: { tier, isAuthenticated: true, capacityDisclosed, onSelectTier: vi.fn() }
	});
}

// #690 / backend #825: `total_available === null` means "unlimited" when the
// event discloses capacity and "withheld" when it does not. Only the event-level
// `show_capacity` distinguishes them.
describe('TierCard — inventory disclosure', () => {
	it('says "Unlimited" for a null quantity when capacity is disclosed', () => {
		renderCard(makeTier({ total_available: null }), true);
		expect(screen.getByText(/unlimited/i)).toBeInTheDocument();
	});

	it('defaults to disclosed when the caller cannot say', () => {
		renderCard(makeTier({ total_available: null }));
		expect(screen.getByText(/unlimited/i)).toBeInTheDocument();
	});

	it('says nothing about inventory for a null quantity when capacity is withheld', () => {
		renderCard(makeTier({ total_available: null }), false);
		expect(screen.queryByText(/unlimited/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
	});

	it('still reports a concrete remaining count regardless of the flag', () => {
		renderCard(makeTier({ total_available: 7 }), false);
		expect(screen.getByText(/7 remaining/i)).toBeInTheDocument();
	});

	it('still reports sold out regardless of the flag', () => {
		// Two nodes: the inventory row and the disabled CTA.
		renderCard(makeTier({ total_available: 0 }), false);
		expect(screen.getAllByText(/sold out/i).length).toBeGreaterThan(0);
	});
});

// Prod incident 2026-09-04 ("Kitts Meets"): the tier listing returns
// `can_purchase: false` for anonymous visitors on any non-public tier, but
// `effectiveEligible` only consulted it when `tierRemainingInfo` (authenticated
// my-status data) existed. A logged-out guest on a can_attend_without_login
// event therefore saw an ENABLED CTA on an invited-only tier and hit a dead
// confirmation link / 403 at checkout.
describe('TierCard — can_purchase=false for anonymous guests', () => {
	function renderAnonymousGuestCard(tier: TierSchemaWithId): void {
		render(TierCard, {
			props: {
				tier,
				isAuthenticated: false,
				canAttendWithoutLogin: true,
				isEligible: true,
				tierRemainingInfo: undefined,
				onSelectTier: vi.fn()
			}
		});
	}

	it('never renders an enabled claim/buy/reserve action on a free tier', () => {
		renderAnonymousGuestCard(makeTier({ can_purchase: false, payment_method: 'free' }));
		expect(screen.queryByRole('button', { name: /claim free ticket/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /buy ticket/i })).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /reserve ticket/i })).not.toBeInTheDocument();
	});

	it('never renders an enabled buy action on a paid tier', () => {
		renderAnonymousGuestCard(
			makeTier({ can_purchase: false, payment_method: 'online', price: '10.00' })
		);
		expect(screen.queryByRole('button', { name: /buy ticket/i })).not.toBeInTheDocument();
	});

	it('shows a disabled action with a visible reason instead of "Coming soon"', () => {
		renderAnonymousGuestCard(makeTier({ can_purchase: false, payment_method: 'free' }));
		const disabledCta = screen.getByRole('button', { name: /not eligible/i });
		expect(disabledCta).toBeDisabled();
		expect(screen.getByText(/not available/i)).toBeInTheDocument();
		expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
	});

	it('still renders the enabled CTA when can_purchase is true', () => {
		renderAnonymousGuestCard(makeTier({ can_purchase: true, payment_method: 'free' }));
		expect(screen.getByRole('button', { name: /claim free ticket/i })).toBeEnabled();
	});
});

// Backend #923: guests can claim invitation links. The anonymous tier listing
// still reports can_purchase: false for invited-only tiers even when a token
// is present (the backend cannot know the guest yet), so a granting token must
// unlock the guest path client-side for invited/invited_and_members tiers.
describe('TierCard — invitation-link token unlocks invited tiers for guests', () => {
	function makeToken(overrides: Partial<EventTokenSchema> = {}): EventTokenSchema {
		return {
			id: 'token-1',
			event_name: 'Test Event',
			event_slug: 'test-event',
			organization_slug: 'test-org',
			event_start: '2026-10-01T18:00:00Z',
			issuer: 'user-1',
			event: 'event-1',
			created_at: '2026-09-01T00:00:00Z',
			grants_invitation: true,
			ticket_tiers: [],
			...overrides
		};
	}

	function renderWithToken(
		tier: TierSchemaWithId,
		eventTokenDetails: EventTokenSchema | null,
		props: Record<string, unknown> = {}
	): void {
		render(TierCard, {
			props: {
				tier,
				isAuthenticated: false,
				canAttendWithoutLogin: true,
				isEligible: true,
				eventTokenDetails,
				onSelectTier: vi.fn(),
				...props
			}
		});
	}

	const invitedTier = () =>
		makeTier({ can_purchase: false, purchasable_by: 'invited', payment_method: 'free' });

	it('enables the guest CTA on an invited tier when a granting token is present', () => {
		renderWithToken(invitedTier(), makeToken());
		expect(screen.getByRole('button', { name: /claim free ticket/i })).toBeEnabled();
	});

	it('enables invited_and_members tiers too', () => {
		renderWithToken(
			makeTier({
				can_purchase: false,
				purchasable_by: 'invited_and_members',
				payment_method: 'online',
				price: '10.00'
			}),
			makeToken()
		);
		expect(screen.getByRole('button', { name: /buy ticket/i })).toBeEnabled();
	});

	it('keeps members-only tiers blocked despite a granting token', () => {
		renderWithToken(
			makeTier({ can_purchase: false, purchasable_by: 'members', payment_method: 'free' }),
			makeToken()
		);
		expect(screen.queryByRole('button', { name: /claim free ticket/i })).not.toBeInTheDocument();
	});

	it('stays disabled when the token does not grant an invitation', () => {
		renderWithToken(invitedTier(), makeToken({ grants_invitation: false }));
		expect(screen.queryByRole('button', { name: /claim free ticket/i })).not.toBeInTheDocument();
	});

	it('stays disabled without any token (fix for the incident stands)', () => {
		renderWithToken(invitedTier(), null);
		expect(screen.queryByRole('button', { name: /claim free ticket/i })).not.toBeInTheDocument();
	});

	it('ignores tokens for another event', () => {
		// A public event page can load token details for an unrelated ?et=
		// token; the backend ignores other-event tokens at checkout, so the
		// card must not enable the restricted tier.
		renderWithToken(invitedTier(), makeToken({ event: 'other-event' }));
		expect(screen.queryByRole('button', { name: /claim free ticket/i })).not.toBeInTheDocument();
	});

	// The token's ticket_tiers are the tiers auto-ASSIGNED on claim, not a
	// purchase restriction: the backend's assert_purchasable_by passes ANY
	// invited tier for an invitation holder unless that tier sets
	// restrict_purchase_to_linked_invitations — a flag the public tier schema
	// does not expose. So a granting token unlocks invited tiers regardless of
	// which tiers it names; the rare restricted-and-unlinked tier gets a clear
	// 403 at checkout (surfaced since this PR) rather than being silently
	// blocked here alongside legitimately purchasable ones.
	it('unlocks an invited tier the token happens to name', () => {
		const tierScopedToken = makeToken({
			ticket_tiers: [makeTier({ id: 'tier-1' }) as TicketTierSchema]
		});
		renderWithToken(invitedTier(), tierScopedToken);
		expect(screen.getByRole('button', { name: /claim free ticket/i })).toBeEnabled();
	});

	it('also unlocks an invited tier the token does not name', () => {
		const otherTierToken = makeToken({
			ticket_tiers: [makeTier({ id: 'other-tier' }) as TicketTierSchema]
		});
		renderWithToken(invitedTier(), otherTierToken);
		expect(screen.getByRole('button', { name: /claim free ticket/i })).toBeEnabled();
	});

	it('never applies the token path for authenticated users', () => {
		// A signed-in user's can_purchase already reflects their real
		// invitations; the token override is guest-only.
		renderWithToken(invitedTier(), makeToken(), { isAuthenticated: true });
		expect(screen.queryByRole('button', { name: /claim free ticket/i })).not.toBeInTheDocument();
	});

	it('never applies the token path when the event disallows guests', () => {
		renderWithToken(invitedTier(), makeToken(), { canAttendWithoutLogin: false });
		expect(screen.queryByRole('button', { name: /claim free ticket/i })).not.toBeInTheDocument();
	});
});
