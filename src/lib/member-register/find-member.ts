import type {
	MembershipRecordSchema,
	OrganizationMemberSchema
} from '$lib/api/generated/types.gen';

/** The register fields the member lookup reads. */
export type MemberLookupTarget = Pick<MembershipRecordSchema, 'user_id' | 'email' | 'full_name'>;

/**
 * Find the access row (`OrganizationMemberSchema`) of a linked register entry.
 *
 * The member actions are keyed on the linked USER, but the member list cannot
 * filter by user id: the member is looked up with the entry's email (then its
 * name) and matched EXACTLY on `user.id`, so a name that matches several people
 * or an email that differs from the account's current one can never pick the
 * wrong person. Resolves to null when nobody matches (or every lookup fails).
 */
export async function findMemberByUserId(
	target: MemberLookupTarget,
	search: (term: string) => Promise<OrganizationMemberSchema[]>
): Promise<OrganizationMemberSchema | null> {
	if (!target.user_id) return null;
	const terms = [target.email, target.full_name].filter((t): t is string => !!t);
	for (const term of terms) {
		try {
			const match = (await search(term)).find((member) => member.user.id === target.user_id);
			if (match) return match;
		} catch {
			// Fall through to the next term.
		}
	}
	return null;
}
