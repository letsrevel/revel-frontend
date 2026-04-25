import * as m from '$lib/paraglide/messages.js';

/**
 * Resolve a backend field name (possibly nested, e.g. "refund_policy.tiers.0.hours_before_event")
 * to a localized, human-readable label for the TierForm error renderer.
 *
 * Falls through to the raw field name for unknown roots so we never silently
 * swallow a useful identifier.
 */
const LABELS: Record<string, () => string> = {
	name: () => m['tierForm.field.name'](),
	description: () => m['tierForm.field.description'](),
	price: () => m['tierForm.field.price'](),
	currency: () => m['tierForm.field.currency'](),
	vat_rate: () => m['tierForm.field.vat_rate'](),
	manual_payment_instructions: () => m['tierForm.field.manual_payment_instructions'](),
	total_quantity: () => m['tierForm.field.total_quantity'](),
	sales_start_at: () => m['tierForm.field.sales_start_at'](),
	sales_end_at: () => m['tierForm.field.sales_end_at'](),
	visibility: () => m['tierForm.field.visibility'](),
	purchasable_by: () => m['tierForm.field.purchasable_by'](),
	restricted_to_membership_tiers_ids: () =>
		m['tierForm.field.restricted_to_membership_tiers_ids'](),
	seat_assignment_mode: () => m['tierForm.field.seat_assignment_mode'](),
	max_tickets_per_user: () => m['tierForm.field.max_tickets_per_user'](),
	venue_id: () => m['tierForm.field.venue_id'](),
	sector_id: () => m['tierForm.field.sector_id'](),
	allow_user_cancellation: () => m['tierForm.field.allow_user_cancellation'](),
	cancellation_deadline_hours: () => m['tierForm.field.cancellation_deadline_hours'](),
	refund_policy: () => m['tierForm.field.refund_policy'](),
	pwyc_min: () => m['tierForm.field.pwyc_min'](),
	pwyc_max: () => m['tierForm.field.pwyc_max'](),
	price_type: () => m['tierForm.field.price_type'](),
	payment_method: () => m['tierForm.field.payment_method']()
};

export function tierFieldLabel(field: string): string {
	const root = field.split('.')[0];
	const known = LABELS[root];
	if (!known) return field;
	const rest = field.slice(root.length).replace(/^\./, '');
	return rest ? `${known()} (${rest})` : known();
}
