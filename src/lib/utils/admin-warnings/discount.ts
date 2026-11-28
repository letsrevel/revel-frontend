/**
 * Discount code warning rules (#1314, G1a, G1b). Pure functions: each returns
 * an `AdminWarning`, or `null` when the setting is fine.
 *
 * Scope is the UNION that the backend uses: the tiers of the selected events
 * plus the selected tiers. The rules stay silent when a series is selected,
 * while the tier data loads, and when the tier list is empty.
 */
import * as m from '$lib/paraglide/messages.js';
import type { AdminWarning } from './types';

export interface DiscountScopeTier {
	id?: string | null;
	payment_method?: string | null;
	price_type?: string | null;
	currency?: string | null;
}

export interface DiscountScopeInput {
	/** A series in the scope: the tiers are not resolved, so the rules do not fire. */
	seriesSelected: boolean;
	/** `true` once the tier query has succeeded. */
	tiersLoaded: boolean;
	/** Every tier of the selected events. */
	eventTiers: ReadonlyArray<DiscountScopeTier>;
	/** The selected tiers, resolved. */
	selectedTiers: ReadonlyArray<DiscountScopeTier>;
}

export interface DiscountFixedCurrencyInput extends DiscountScopeInput {
	discount_type: string | null | undefined;
	currency: string | null | undefined;
}

/** Returns the tiers in scope, or `null` when the rules must stay silent. */
function resolveScope(input: DiscountScopeInput): DiscountScopeTier[] | null {
	if (input.seriesSelected || !input.tiersLoaded) return null;
	const byId = new Map<string, DiscountScopeTier>();
	const anonymous: DiscountScopeTier[] = [];
	for (const tier of [...input.eventTiers, ...input.selectedTiers]) {
		if (tier.id) byId.set(tier.id, tier);
		else anonymous.push(tier);
	}
	const tiers = [...byId.values(), ...anonymous];
	return tiers.length > 0 ? tiers : null;
}

/** G1a: every tier in scope is free or pay-what-you-can, so the code gives nothing. */
export function discountOnlyFreeTiers(input: DiscountScopeInput): AdminWarning | null {
	const tiers = resolveScope(input);
	if (!tiers) return null;
	if (!tiers.every((t) => t.payment_method === 'free' || t.price_type === 'pwyc')) return null;
	return {
		id: 'G1a',
		level: 'warn',
		title: () => m['adminWarnings.discountG1aTitle'](),
		message: () => m['adminWarnings.discountG1aMessage']()
	};
}

/** G1b: fixed amount in a currency that no tier in scope uses. Silent when tiers are selected. */
export function discountCurrencyUnused(input: DiscountFixedCurrencyInput): AdminWarning | null {
	if (input.discount_type !== 'fixed_amount') return null;
	const currency = (input.currency ?? '').trim().toUpperCase();
	if (currency === '') return null;
	// With selected tiers the backend takes the currency from the tiers, and the form hides the field.
	if (input.selectedTiers.length > 0) return null;
	const tiers = resolveScope(input);
	if (!tiers) return null;
	if (tiers.some((t) => (t.currency ?? '').toUpperCase() === currency)) return null;
	return {
		id: 'G1b',
		level: 'warn',
		title: () => m['adminWarnings.discountG1bTitle'](),
		message: () => m['adminWarnings.discountG1bMessage']()
	};
}
