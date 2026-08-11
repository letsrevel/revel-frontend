import type { CheckInResponseSchema, MemberScanResponseSchema } from '$lib/api/generated/types.gen';

/** The 200 body of `POST /event-admin/{event_id}/tickets/{code}/check-in`. */
export type CheckInScanPayload = CheckInResponseSchema | MemberScanResponseSchema;

export type CheckInOutcome =
	| { kind: 'checked_in'; result: CheckInResponseSchema }
	| { kind: 'member'; report: MemberScanResponseSchema }
	| { kind: 'unknown' };

/**
 * Narrow a check-in 200 into the arm the scanner should render.
 *
 * The backend discriminates with `kind`, but that field carries a schema DEFAULT
 * and is absent from `required`, so the generated type is `kind?: 'member'` —
 * optional on BOTH arms. Two consequences this function exists to absorb:
 *
 *  1. Never narrow with a negative test (`kind !== 'checked_in'`). An absent
 *     discriminator would fall into the wrong arm, and the scanner would read
 *     `.user` off a member report — the exact crash the regen's type error
 *     flagged.
 *  2. When `kind` IS absent (an older deployment, or a serializer that drops
 *     defaults), fall back to the payload's own shape. `member` and `user` are
 *     required on exactly one arm each, so the shapes are unambiguous.
 */
export function classifyCheckInResponse(payload: unknown): CheckInOutcome {
	if (!payload || typeof payload !== 'object') return { kind: 'unknown' };

	const candidate = payload as Partial<CheckInResponseSchema & MemberScanResponseSchema>;

	if (candidate.kind === 'member') {
		return { kind: 'member', report: payload as MemberScanResponseSchema };
	}
	if (candidate.kind === 'checked_in') {
		return { kind: 'checked_in', result: payload as CheckInResponseSchema };
	}

	// No discriminator — fall back to the required-field shapes.
	if (candidate.member) {
		return { kind: 'member', report: payload as MemberScanResponseSchema };
	}
	if (candidate.user) {
		return { kind: 'checked_in', result: payload as CheckInResponseSchema };
	}
	return { kind: 'unknown' };
}
