/**
 * The tier being built survives the round-trip to Stripe onboarding: the form
 * stashes its fields in sessionStorage right before the redirect, and the
 * ticketing tab reopens it prefilled when Stripe sends the owner back.
 */

import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';
import { toDatetimeLocal } from './tier-form-helpers';

export interface TierDraft {
	/** Existing tier being edited, or null for a new one. */
	tierId: string | null;
	name: string;
	description: string;
	paymentMethod: 'free' | 'offline' | 'at_the_door' | 'online';
	priceType: 'fixed' | 'pwyc';
	price: string;
	pwycMin: string;
	pwycMax: string;
	currency: string;
	vatRateOverride: string;
	manualPaymentInstructions: string;
	totalQuantity: string;
	salesStartAt: string;
	salesEndAt: string;
	maxTicketsPerUser: string;
	visibility: 'public' | 'private' | 'members-only' | 'staff-only';
	purchasableBy: 'public' | 'members' | 'invited' | 'invited_and_members';
}

const key = (eventId: string): string => `revel:tier-draft:${eventId}`;

export function stashTierDraft(eventId: string, draft: TierDraft): void {
	try {
		sessionStorage.setItem(key(eventId), JSON.stringify(draft));
	} catch {
		// Storage unavailable: the redirect still goes ahead, the draft is lost.
	}
}

/** Reads and removes the stash. Missing or corrupted data yields null. */
export function takeTierDraft(eventId: string): TierDraft | null {
	try {
		const raw = sessionStorage.getItem(key(eventId));
		sessionStorage.removeItem(key(eventId));
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null) return null;
		const d = parsed as Partial<TierDraft>;
		if (typeof d.name !== 'string' || typeof d.paymentMethod !== 'string') return null;
		return d as TierDraft;
	} catch {
		return null;
	}
}

export type StripeGate = 'connect' | 'billing' | null;

/**
 * Which Stripe prerequisite (if any) blocks an online tier. Null when the
 * method isn't online, online sales are unavailable for compliance reasons
 * (that callout takes over), or the org is ready.
 */
export function stripeGateFor(
	paymentMethod: string,
	onlineUnavailable: boolean,
	connected: boolean,
	billingNeedsAttention: boolean
): StripeGate {
	if (paymentMethod !== 'online' || onlineUnavailable) return null;
	if (!connected) return 'connect';
	return billingNeedsAttention ? 'billing' : null;
}

/** Initial form fields: the restored draft wins over the stored tier, which wins over defaults. */
export function tierSeed(tier: TicketTierDetailSchema | null, draft: TierDraft | null): TierDraft {
	return {
		tierId: tier?.id ?? null,
		name: draft?.name ?? tier?.name ?? '',
		description: draft?.description ?? tier?.description ?? '',
		paymentMethod:
			draft?.paymentMethod ?? (tier?.payment_method as TierDraft['paymentMethod']) ?? 'free',
		priceType: draft?.priceType ?? (tier?.price_type as TierDraft['priceType']) ?? 'fixed',
		price: draft?.price ?? (tier?.price ? String(tier.price) : '0'),
		pwycMin: draft?.pwycMin ?? (tier?.pwyc_min ? String(tier.pwyc_min) : '1'),
		pwycMax: draft?.pwycMax ?? (tier?.pwyc_max ? String(tier.pwyc_max) : ''),
		currency: draft?.currency ?? tier?.currency ?? 'EUR',
		vatRateOverride:
			draft?.vatRateOverride ?? (tier?.vat_rate != null ? String(tier.vat_rate) : ''),
		manualPaymentInstructions:
			draft?.manualPaymentInstructions ?? tier?.manual_payment_instructions ?? '',
		totalQuantity: draft?.totalQuantity ?? String(tier?.total_quantity ?? ''),
		salesStartAt: draft?.salesStartAt ?? toDatetimeLocal(tier?.sales_start_at),
		salesEndAt: draft?.salesEndAt ?? toDatetimeLocal(tier?.sales_end_at),
		maxTicketsPerUser: draft?.maxTicketsPerUser ?? String(tier?.max_tickets_per_user ?? ''),
		visibility: draft?.visibility ?? (tier?.visibility as TierDraft['visibility']) ?? 'public',
		purchasableBy:
			draft?.purchasableBy ?? (tier?.purchasable_by as TierDraft['purchasableBy']) ?? 'public'
	};
}
