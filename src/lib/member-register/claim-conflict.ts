import type { MemberRegisterInviteClaimErrorSchema } from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

/** Machine codes of the invite-claim 409, taken from the generated schema. */
export type ClaimConflictCode = MemberRegisterInviteClaimErrorSchema['code'];

/**
 * Localized copy per code. Typed as a full `Record`, so a code the backend adds
 * to the generated union fails the type check until its copy is written here.
 */
export const CLAIM_CONFLICT_COPY: Record<ClaimConflictCode, () => string> = {
	already_member: () => m['memberInvite.conflictAlreadyMember'](),
	not_started: () => m['memberInvite.conflictNotStarted']()
};

/** Type guard: is this value one of the codes we have copy for? */
export function isClaimConflictCode(code: unknown): code is ClaimConflictCode {
	return typeof code === 'string' && Object.hasOwn(CLAIM_CONFLICT_COPY, code);
}
