/**
 * Ticket tier warning rules (#1314, D1-D4). Pure functions: each returns an
 * `AdminWarning`, or `null` when the setting is fine. Callers add the fix
 * target and the action.
 */
import * as m from '$lib/paraglide/messages.js';
import type { AdminWarning } from './types';

export interface TierOnlinePaymentInput {
	payment_method: string | null | undefined;
	organizationStripeConnected: boolean;
}

export interface TierFreePriceInput {
	payment_method: string | null | undefined;
	price: string | number | null | undefined;
}

export interface TierAudienceInput {
	visibility: string | null | undefined;
	purchasable_by: string | null | undefined;
}

export interface TierOfflineInstructionsInput {
	payment_method: string | null | undefined;
	manual_payment_instructions: string | null | undefined;
}

const RESTRICTED_BUYERS: ReadonlySet<string> = new Set([
	'invited',
	'members',
	'invited_and_members'
]);

/** D1: online tier, but the organization cannot receive online payments. */
export function tierOnlineWithoutStripe(input: TierOnlinePaymentInput): AdminWarning | null {
	if (input.payment_method !== 'online' || input.organizationStripeConnected) return null;
	return {
		id: 'D1',
		level: 'warn',
		title: () => m['adminWarnings.tierD1Title'](),
		message: () => m['adminWarnings.tierD1Message']()
	};
}

/** D2: free payment method with a price above zero. */
export function tierFreeWithPrice(input: TierFreePriceInput): AdminWarning | null {
	if (input.payment_method !== 'free') return null;
	const price = typeof input.price === 'number' ? input.price : parseFloat(input.price ?? '');
	if (!(price > 0)) return null;
	return {
		id: 'D2',
		level: 'warn',
		title: () => m['adminWarnings.tierD2Title'](),
		message: () => m['adminWarnings.tierD2Message']()
	};
}

/** D3: public tier that only invited guests or members can buy. */
export function tierPublicButRestricted(input: TierAudienceInput): AdminWarning | null {
	if (input.visibility !== 'public') return null;
	if (!input.purchasable_by || !RESTRICTED_BUYERS.has(input.purchasable_by)) return null;
	return {
		id: 'D3',
		level: 'info',
		title: () => m['adminWarnings.tierD3Title'](),
		message: () => m['adminWarnings.tierD3Message']()
	};
}

/** D4: offline payment without instructions (not for at_the_door). */
export function tierOfflineWithoutInstructions(
	input: TierOfflineInstructionsInput
): AdminWarning | null {
	if (input.payment_method !== 'offline') return null;
	if ((input.manual_payment_instructions ?? '').trim() !== '') return null;
	return {
		id: 'D4',
		level: 'info',
		title: () => m['adminWarnings.tierD4Title'](),
		message: () => m['adminWarnings.tierD4Message']()
	};
}
