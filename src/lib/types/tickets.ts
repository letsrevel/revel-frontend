/**
 * Extended ticket tier schemas with fixes for backend issues
 */

import type { TierSchema } from '$lib/api/generated/types.gen';

/**
 * TierSchema with id field
 *
 * BACKEND ISSUE: The public TierSchema doesn't include 'id', but it's required
 * for the checkout endpoint. This extension assumes the backend will be fixed
 * to include the id field.
 *
 * See: BACKEND_ISSUES.md for details
 */
export type TierSchemaWithId = TierSchema & {
	id: string; // UUID
};

/**
 * Type guard to check if a TierSchema has an id
 */
export function hasTierId(tier: TierSchema): tier is TierSchemaWithId {
	return 'id' in tier && typeof (tier as any).id === 'string';
}
