import type {
	MembershipRecordSchema,
	OrganizationMemberSchema
} from '$lib/api/generated/types.gen';

/** The register fields the "Manage access" bridge reads. */
export type AccessTarget = Pick<MembershipRecordSchema, 'user_id' | 'email' | 'full_name'>;

/**
 * Search text for the member list when "Manage access" is opened on a register
 * entry. The bridge is keyed on the linked USER, not the entry's email: the
 * register email can differ from the account's current one (or be missing), and
 * a name search can match several people.
 *
 * The member list cannot filter by user id, so the member is looked up with the
 * entry's email (then its name) and matched EXACTLY on `user.id`; their current
 * email becomes the search. With no exact match (or a failing lookup) it falls
 * back to the entry's own email, then its name.
 */
export async function resolveAccessSearch(
	target: AccessTarget,
	findMembers: (search: string) => Promise<OrganizationMemberSchema[]>
): Promise<string> {
	const fallback = target.email || target.full_name;
	if (!target.user_id) return fallback;
	const terms = [target.email, target.full_name].filter((t): t is string => !!t);
	for (const term of terms) {
		try {
			const match = (await findMembers(term)).find((member) => member.user.id === target.user_id);
			if (match) return match.user.email || term;
		} catch {
			// Fall through to the next term, then to the plain fallback.
		}
	}
	return fallback;
}
