import { describe, it, expect } from 'vitest';
import { classifyCheckInResponse } from './check-in-scan';
import type { CheckInResponseSchema, MemberScanResponseSchema } from '$lib/api/generated/types.gen';

const USER = {
	preferred_name: 'Bella Distefano',
	pronouns: 'they/them',
	first_name: 'Bella',
	last_name: 'Distefano',
	email: 'bella@example.com',
	display_name: 'Bella Distefano',
	bio: ''
};

const CHECKED_IN: CheckInResponseSchema = {
	kind: 'checked_in',
	user: USER,
	tier: null,
	price_paid: null,
	seat: null
} as CheckInResponseSchema;

const MEMBER_REPORT: MemberScanResponseSchema = {
	kind: 'member',
	member: {
		member_id: '3f1b8b9a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
		status: 'active',
		member_since: '2025-03-14T10:00:00Z',
		tier: null,
		user: USER
	},
	tickets: [],
	detail: 'This member has no ticket for this event.'
};

describe('classifyCheckInResponse', () => {
	it('classifies a ticket check-in', () => {
		const outcome = classifyCheckInResponse(CHECKED_IN);
		expect(outcome.kind).toBe('checked_in');
		if (outcome.kind !== 'checked_in') throw new Error('narrowing failed');
		expect(outcome.result.user.display_name).toBe('Bella Distefano');
	});

	it('classifies a membership-card report', () => {
		const outcome = classifyCheckInResponse(MEMBER_REPORT);
		expect(outcome.kind).toBe('member');
		if (outcome.kind !== 'member') throw new Error('narrowing failed');
		expect(outcome.report.member.status).toBe('active');
	});

	/**
	 * `kind` carries a schema DEFAULT and is absent from `required`, so the
	 * generated type is `kind?: 'member'`. A backend that stops emitting the field
	 * (or an older deployment) must not silently classify a member report as a
	 * ticket check-in and make the scanner read `.user` off it.
	 */
	it('falls back to the member arm when kind is absent but a member payload is present', () => {
		const withoutKind = { ...MEMBER_REPORT };
		delete (withoutKind as { kind?: string }).kind;
		const outcome = classifyCheckInResponse(withoutKind);
		expect(outcome.kind).toBe('member');
	});

	it('falls back to the checked-in arm when kind is absent but a user payload is present', () => {
		const withoutKind = { ...CHECKED_IN };
		delete (withoutKind as { kind?: string }).kind;
		const outcome = classifyCheckInResponse(withoutKind);
		expect(outcome.kind).toBe('checked_in');
	});

	it('treats a missing payload as unknown rather than guessing', () => {
		expect(classifyCheckInResponse(undefined).kind).toBe('unknown');
		expect(classifyCheckInResponse(null).kind).toBe('unknown');
	});

	// An explicit `kind` always wins over shape sniffing — that is the whole
	// point of the discriminator.
	it('trusts an explicit kind over the payload shape', () => {
		const outcome = classifyCheckInResponse({ ...MEMBER_REPORT, kind: 'member' });
		expect(outcome.kind).toBe('member');
	});
});
