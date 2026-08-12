// Membership-card QR payload contract, shared by the producer (the in-app
// membership card renders the QR) and the two consumers (the event scanner and
// the org-scoped door verification). Mirrors the backend's
// `OrganizationMember.QR_PREFIX` — the third namespace after bare ticket UUIDs
// and `series:`.
//
// The frontend never CONSTRUCTS a member payload: `MyMembershipSchema.qr_payload`
// arrives ready-made and is rendered verbatim. These helpers exist only to
// classify and clean up codes coming back IN, from a camera or from staff typing.
export const MEMBER_QR_PREFIX = 'member:';

/** Whether a scanned code is a membership card (vs a ticket UUID or `series:`). */
export function isMemberCode(code: string): boolean {
	return code.trim().toLowerCase().startsWith(MEMBER_QR_PREFIX);
}

/**
 * Clean a scanned or hand-typed code for the wire.
 *
 * Both endpoints that accept these codes declare an ANCHORED path pattern
 * (`^(member:)?[0-9a-fA-F]{8}-…$`), so a stray space or an autocorrected
 * `Member:` 422s in Ninja's path validation before any controller runs — a
 * failure that would read to door staff as "this card is invalid".
 *
 * The UUID's own case is preserved: the pattern accepts either, and rewriting it
 * would be a change this function has no business making.
 */
export function normalizeMemberCode(code: string): string {
	const trimmed = code.trim();
	if (!isMemberCode(trimmed)) return trimmed;
	return MEMBER_QR_PREFIX + trimmed.slice(MEMBER_QR_PREFIX.length);
}
