/**
 * Extended ticket tier schemas with fixes for backend issues
 */

import type { TicketTierSchema } from '$lib/api/generated/types.gen';

/**
 * TicketTierSchema with id field
 *
 * BACKEND NOTE: TicketTierSchema now properly includes all fields including:
 * - 'id' (required for checkout endpoint)
 * - 'manual_payment_instructions' (for offline/at-the-door payments)
 *
 * This type is just an alias for clarity that we're using tiers with IDs.
 */
export type TierSchemaWithId = TicketTierSchema;

/**
 * Type guard to check if a TicketTierSchema has an id
 */
export function hasTierId(tier: TicketTierSchema): tier is TierSchemaWithId {
	return 'id' in tier && typeof (tier as any).id === 'string';
}
