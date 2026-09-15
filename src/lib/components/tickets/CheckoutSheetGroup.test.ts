/**
 * The cancellation/refund terms must reach the buyer BEFORE they confirm
 * (#931): the policy is snapshotted onto the ticket at purchase, so a sheet
 * that never shows it has the buyer agreeing to terms they haven't read.
 * `CheckoutSheetGroup` is the one card per distinct cart tier, and the sole
 * checkout surface both the authenticated and the guest flow pass through.
 */
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import CheckoutSheetGroup from './CheckoutSheetGroup.svelte';
import { EventCart, type CartGroup } from './cart.svelte';
import { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
import type { TierSchemaWithId } from '$lib/types/tickets';
import * as m from '$lib/paraglide/messages.js';

const EVENT_ID = '11111111-1111-1111-1111-111111111111';

const paidTier: TierSchemaWithId = {
	id: 'tier-1',
	event_id: EVENT_ID,
	name: 'General Admission',
	price: '25.00',
	currency: 'EUR',
	total_available: null,
	seat_assignment_mode: 'none',
	payment_method: 'online',
	allow_user_cancellation: false
};

const refundableTier: TierSchemaWithId = {
	...paidTier,
	allow_user_cancellation: true,
	cancellation_deadline_hours: 24,
	refund_policy: {
		// Deliberately out of order: the summary sorts descending itself.
		tiers: [
			{ hours_before_event: 48, refund_percentage: '50' },
			{ hours_before_event: 168, refund_percentage: '100' }
		],
		flat_fee: '2.00'
	}
};

const freeTier: TierSchemaWithId = {
	...paidTier,
	price: '0.00',
	payment_method: 'free',
	allow_user_cancellation: false
};

function groupFor(tier: TierSchemaWithId): CartGroup {
	return {
		tier,
		quantity: 2,
		guestNames: [],
		pwycAmount: null,
		priceCategoryId: null,
		accessibleRequired: false,
		seatIds: []
	};
}

function renderGroup(tier: TierSchemaWithId) {
	const cart = new EventCart({ remainingFor: () => undefined, eventRemaining: () => null });
	return render(CheckoutSheetGroup, {
		props: {
			group: groupFor(tier),
			cart,
			requireTicketNames: false,
			isProcessing: false,
			isFree: tier.payment_method === 'free',
			chart: null,
			discountedPrice: null,
			registry: new CartSeatHoldRegistry(),
			isGuest: false,
			onPwycKeydown: vi.fn()
		}
	});
}

describe('CheckoutSheetGroup — cancellation policy (#931)', () => {
	it('tells the buyer a non-refundable tier is non-refundable', () => {
		renderGroup(paidTier);

		expect(screen.getByText(m['cancellationPolicy.nonRefundableTitle']())).toBeInTheDocument();
		expect(screen.getByText(m['cancellationPolicy.nonRefundableHelp']())).toBeInTheDocument();
	});

	it('lists every refund bracket, the deadline and the flat fee', () => {
		renderGroup(refundableTier);

		expect(screen.getByText(m['cancellationPolicy.title']())).toBeInTheDocument();

		const brackets = screen.getAllByRole('listitem').map((item) => item.textContent?.trim());
		expect(brackets).toEqual([
			m['cancellationPolicy.bracketRow']({ hours: '168', pct: '100' }),
			m['cancellationPolicy.bracketRow']({ hours: '48', pct: '50' })
		]);

		expect(
			screen.getByText(m['cancellationPolicy.deadlineNote']({ hours: '24' }))
		).toBeInTheDocument();
		// The fee renders money-formatted (`formatPrice`), not as the raw decimal.
		expect(
			screen.getByText(m['cancellationPolicy.flatFeeNote']({ fee: '€2.00' }))
		).toBeInTheDocument();
	});

	it('stays silent for a free tier, which has nothing to refund', () => {
		renderGroup(freeTier);

		expect(screen.queryByText(m['cancellationPolicy.title']())).not.toBeInTheDocument();
		expect(
			screen.queryByText(m['cancellationPolicy.nonRefundableTitle']())
		).not.toBeInTheDocument();
	});
});
