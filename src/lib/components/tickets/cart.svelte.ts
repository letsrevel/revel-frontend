/**
 * Per-event shopping cart for the multi-tier checkout (#853). One CartGroup per
 * tier, mirroring the backend's CheckoutGroupSchema. In-memory only: seat holds
 * are server-backed and everything else is cheap to re-pick.
 *
 * The cart enforces the two cart-wide constraints worth preventing pre-submit
 * (one currency, one payment method) and the layered per-user caps:
 * per-tier `remaining` is already min(tier cap, event cap) server-side; the
 * event-level shared budget (BE #901) additionally shrinks as OTHER groups
 * grow. Everything else relies on the API's 400s.
 */
import type { TierSchemaWithId } from '$lib/types/tickets';
import type { TierRemainingTicketsSchema } from '$lib/api/generated/types.gen';

export const MAX_TICKETS_PER_GROUP = 50;
export const MAX_CART_GROUPS = 20;

export interface CartGroup {
	tier: TierSchemaWithId;
	quantity: number;
	guestNames: string[];
	pwycAmount: string | null;
	priceCategoryId: string | null;
	accessibleRequired: boolean;
	seatIds: string[];
}

export type JoinBlock = 'currency' | 'payment_method' | null;

export interface EventCartDeps {
	/** Per-tier layered remaining from my-status; undefined = no info. */
	remainingFor: (tierId: string) => TierRemainingTicketsSchema | undefined;
	/** Event-level shared budget (BE #901); null = no cap / not exposed yet. */
	eventRemaining: () => number | null;
}

/** A tier the buyer can quantity-pick without any extra input (spec §2.1). */
export function quickBuyEligible(tier: TierSchemaWithId, requireTicketNames: boolean): boolean {
	return (
		!requireTicketNames &&
		tier.price_type !== 'pwyc' &&
		tier.seat_assignment_mode === 'none' &&
		tier.payment_method !== 'hidden'
	);
}

export class EventCart {
	#deps: EventCartDeps;
	groups = $state<CartGroup[]>([]);

	constructor(deps: EventCartDeps) {
		this.#deps = deps;
	}

	readonly isEmpty = $derived(this.groups.length === 0);
	readonly totalCount = $derived(this.groups.reduce((sum, g) => sum + g.quantity, 0));
	readonly currency = $derived(this.groups[0]?.tier.currency ?? null);
	readonly paymentMethod = $derived(this.groups[0]?.tier.payment_method ?? null);

	groupFor(tierId: string): CartGroup | undefined {
		return this.groups.find((g) => g.tier.id === tierId);
	}

	quantityFor(tierId: string): number {
		return this.groupFor(tierId)?.quantity ?? 0;
	}

	joinBlock(tier: TierSchemaWithId): JoinBlock {
		if (this.isEmpty || this.groupFor(tier.id)) return null;
		if (tier.payment_method !== this.paymentMethod) return 'payment_method';
		if (tier.currency !== this.currency) return 'currency';
		return null;
	}

	maxQuantity(tier: TierSchemaWithId): number {
		if (!this.groupFor(tier.id) && this.groups.length >= MAX_CART_GROUPS) return 0;
		let cap = MAX_TICKETS_PER_GROUP;
		if (tier.total_available != null) cap = Math.min(cap, tier.total_available);
		// Per-tier term: my-status info when present (remaining: null = unlimited);
		// first-time buyers get the eligibility shape with NO remaining_tickets at
		// all (BE #902 note on #853), so fall back to the tier's own cap. Guard on
		// tier_id matching the tier we asked about — a lookup that doesn't filter
		// by id must never leak another tier's remaining onto this one.
		const info = this.#deps.remainingFor(tier.id);
		const matchedInfo = info && info.tier_id === tier.id ? info : undefined;
		const tierTerm = matchedInfo ? matchedInfo.remaining : (tier.max_tickets_per_user ?? null);
		if (tierTerm != null) cap = Math.min(cap, tierTerm);
		const eventRemaining = this.#deps.eventRemaining();
		if (eventRemaining != null) {
			cap = Math.min(cap, eventRemaining - (this.totalCount - this.quantityFor(tier.id)));
		}
		return Math.max(0, cap);
	}

	setQuantity(tier: TierSchemaWithId, quantity: number): void {
		const clamped = Math.max(0, Math.min(quantity, this.maxQuantity(tier)));
		const existing = this.groupFor(tier.id);
		if (clamped === 0) {
			if (existing) this.groups = this.groups.filter((g) => g.tier.id !== tier.id);
			return;
		}
		if (existing) {
			existing.quantity = clamped;
			return;
		}
		if (this.joinBlock(tier)) return;
		this.groups = [
			...this.groups,
			{
				tier,
				quantity: clamped,
				guestNames: [],
				pwycAmount: null,
				priceCategoryId: null,
				accessibleRequired: false,
				seatIds: []
			}
		];
	}

	clear(): void {
		this.groups = [];
	}
}
