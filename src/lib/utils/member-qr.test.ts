import { describe, it, expect } from 'vitest';
import { MEMBER_QR_PREFIX, isMemberCode, normalizeMemberCode } from './member-qr';

const UUID = '3f1b8b9a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

describe('MEMBER_QR_PREFIX', () => {
	it('mirrors the backend OrganizationMember.QR_PREFIX contract', () => {
		expect(MEMBER_QR_PREFIX).toBe('member:');
	});
});

describe('isMemberCode', () => {
	it('recognizes a membership card payload', () => {
		expect(isMemberCode(`member:${UUID}`)).toBe(true);
	});

	it('rejects a bare ticket UUID', () => {
		expect(isMemberCode(UUID)).toBe(false);
	});

	it('rejects a series-pass payload', () => {
		expect(isMemberCode(`series:${UUID}`)).toBe(false);
	});

	// The scanner hands us whatever the camera decoded, and the manual-entry
	// field hands us whatever staff typed — including a stray leading space or a
	// capitalised prefix from a keyboard's autocorrect.
	it('tolerates surrounding whitespace', () => {
		expect(isMemberCode(`  member:${UUID}  `)).toBe(true);
	});

	it('is case-insensitive on the prefix', () => {
		expect(isMemberCode(`MEMBER:${UUID}`)).toBe(true);
	});
});

describe('normalizeMemberCode', () => {
	// The verify endpoint accepts `member:<uuid>` OR a bare UUID, but its path
	// pattern is anchored — a stray space or an upper-case prefix 422s before the
	// controller ever runs.
	it('trims and lower-cases the prefix', () => {
		expect(normalizeMemberCode(`  MEMBER:${UUID} `)).toBe(`member:${UUID}`);
	});

	it('leaves a bare UUID alone apart from trimming', () => {
		expect(normalizeMemberCode(`  ${UUID} `)).toBe(UUID);
	});

	it('preserves the UUID case it was given', () => {
		const upper = UUID.toUpperCase();
		expect(normalizeMemberCode(`member:${upper}`)).toBe(`member:${upper}`);
	});
});
