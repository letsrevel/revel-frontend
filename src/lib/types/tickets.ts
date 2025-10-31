/**
 * Extended ticket tier schemas with fixes for backend issues
 */

import type { TierSchema } from '$lib/api/generated/types.gen';

/**
 * TierSchema with id field
 *
 * BACKEND NOTE: TierSchema now properly includes all fields including:
 * - 'id' (required for checkout endpoint)
 * - 'manual_payment_instructions' (for offline/at-the-door payments)
 *
 * This type is just an alias for clarity that we're using tiers with IDs.
 */
export type TierSchemaWithId = TierSchema;

/**
 * Type guard to check if a TierSchema has an id
 */
export function hasTierId(tier: TierSchema): tier is TierSchemaWithId {
	return 'id' in tier && typeof (tier as any).id === 'string';
}
