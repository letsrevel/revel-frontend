import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import TierCard from './TierCard.svelte';
import type { TierSchemaWithId } from '$lib/types/tickets';

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
	function renderAnonymousGuestCard(tier: TierSchemaWithId) {
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
