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
	/**
	 * Event's own `max_tickets_per_user` (#853 PR 4) — a guest has no
	 * `remainingFor`/`eventRemaining` info (both come from my-status, which
	 * requires auth), so this is the ONLY per-user cap a guest cart can see.
	 * Optional: absent = no cap from this term (unchanged pre-PR-4 behavior).
	 */
	eventMaxTicketsPerUser?: () => number | null;
}

/**
 * A tier the buyer can quantity-pick with a stepper (spec §2.1). Names and
 * PWYC amounts are no longer disqualifying here — they're collected in the
 * checkout sheet before submit (see `EventCart.needsSheet`). Best-available
 * seated tiers are steppable too (the sheet collects zone/accessible); only
 * `user_choice` tiers need the seat picker instead of a stepper.
 */
export function quickBuyEligible(tier: TierSchemaWithId): boolean {
	return tier.seat_assignment_mode !== 'user_choice' && tier.payment_method !== 'hidden';
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
	/** Groups whose tier requires the buyer to pick specific seats. */
	readonly userChoiceGroups = $derived(
		this.groups.filter((g) => g.tier.seat_assignment_mode === 'user_choice')
	);
	/** Groups whose tier auto-assigns seats server-side (still needs zone/accessible in the sheet). */
	readonly bestAvailableGroups = $derived(
		this.groups.filter((g) => g.tier.seat_assignment_mode === 'best_available')
	);

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
		// Per-person event budget: the fallback for when my-status carries no
		// event_remaining (the guest path). Shared across the whole cart, so
		// other groups' quantities consume it — mirroring the eventRemaining
		// term below (#863 review).
		const eventMaxTickets = this.#deps.eventMaxTicketsPerUser?.();
		if (eventMaxTickets != null) {
			cap = Math.min(cap, eventMaxTickets - (this.totalCount - this.quantityFor(tier.id)));
		}
		const eventRemaining = this.#deps.eventRemaining();
		if (eventRemaining != null) {
			cap = Math.min(cap, eventRemaining - (this.totalCount - this.quantityFor(tier.id)));
		}
		return Math.max(0, cap);
	}

	/**
	 * `user_choice` tiers are quantity-driven by the seat picker, not the stepper —
	 * guard on the tier's (or an already-present group's) seat mode and no-op.
	 */
	setQuantity(tier: TierSchemaWithId, quantity: number): void {
		if (tier.seat_assignment_mode === 'user_choice') return;
		const existing = this.groupFor(tier.id);
		if (existing?.tier.seat_assignment_mode === 'user_choice') return;
		const clamped = Math.max(0, Math.min(quantity, this.maxQuantity(tier)));
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

	/**
	 * Writes the picked seat ids for a `user_choice` tier, creating the group if
	 * absent (respecting `joinBlock`, same as `setQuantity`) and deriving
	 * `quantity` from `seatIds.length`; an empty array removes the group.
	 * Deliberately uncapped here — the seat picker's own controller enforces the
	 * max (via its `getMaxQuantity` callback) as seats are picked, so the store
	 * doesn't duplicate that logic or truncate a list handed to it.
	 */
	setSeatIds(tier: TierSchemaWithId, seatIds: string[]): void {
		const existing = this.groupFor(tier.id);
		if (seatIds.length === 0) {
			if (existing) this.groups = this.groups.filter((g) => g.tier.id !== tier.id);
			return;
		}
		if (existing) {
			existing.seatIds = seatIds;
			existing.quantity = seatIds.length;
			return;
		}
		if (this.joinBlock(tier)) return;
		this.groups = [
			...this.groups,
			{
				tier,
				quantity: seatIds.length,
				guestNames: [],
				pwycAmount: null,
				priceCategoryId: null,
				accessibleRequired: false,
				seatIds
			}
		];
	}

	setZone(tierId: string, priceCategoryId: string | null): void {
		const group = this.groupFor(tierId);
		if (!group) return;
		group.priceCategoryId = priceCategoryId;
	}

	setAccessible(tierId: string, value: boolean): void {
		const group = this.groupFor(tierId);
		if (!group) return;
		group.accessibleRequired = value;
	}

	clear(): void {
		this.groups = [];
	}

	/**
	 * True when checkout needs the sheet: any group needs names or a PWYC
	 * amount, or auto-assigns seats server-side (best_available groups collect
	 * zone/accessible in the sheet). `isGuest` (#853 PR 4) unconditionally
	 * forces the sheet too — a guest needs it for contact/billing details the
	 * direct-buy path never collects; an empty cart never reaches Buy, so the
	 * unguarded OR is harmless.
	 */
	needsSheet(requireTicketNames: boolean, isGuest = false): boolean {
		return (
			isGuest ||
			this.groups.some(
				(g) =>
					requireTicketNames ||
					g.tier.price_type === 'pwyc' ||
					g.tier.seat_assignment_mode === 'best_available'
			)
		);
	}

	/** Writes a guest name at `index`, padding `guestNames` to the group's quantity first. */
	setGuestName(tierId: string, index: number, value: string): void {
		const group = this.groupFor(tierId);
		if (!group) return;
		while (group.guestNames.length < group.quantity) group.guestNames.push('');
		group.guestNames[index] = value;
	}

	setPwycAmount(tierId: string, value: string | null): void {
		const group = this.groupFor(tierId);
		if (!group) return;
		group.pwycAmount = value;
	}
}
