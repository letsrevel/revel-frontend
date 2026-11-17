import * as m from '$lib/paraglide/messages.js';
import type { ContactMethod } from '$lib/api/generated/types.gen';

/** Badge text for a plan's payment method (anything not online/free reads as offline). */
export function planPaymentMethodLabel(method: string | null | undefined): string {
	if (method === 'online') return m['orgAdmin.members.plans.badge.online']();
	if (method === 'free') return m['orgAdmin.members.plans.badge.free']();
	return m['orgAdmin.members.plans.badge.offline']();
}

/**
 * Whether `OrgContactButton` would really render something for this org.
 *
 * Deliberately stricter than `method !== 'none'`: the button's `email` branch
 * also requires an address, so `email` with none on file renders nothing, and
 * copy promising a button would be a dead end.
 */
export function canContactOrg(
	method: ContactMethod | null | undefined,
	email: string | null | undefined
): boolean {
	if (method === 'email') return !!email;
	return method === 'form';
}
