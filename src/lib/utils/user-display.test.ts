import { describe, it, expect } from 'vitest';
import {
	getUserDisplayName,
	getUserRealName,
	isUnknownHolder,
	secondaryEmail,
	staffViewDisplayName
} from './user-display';

const base = { preferred_name: '', first_name: '', last_name: '', email: 'ann@example.com' };

describe('getUserRealName', () => {
	it('prefers the preferred name', () => {
		expect(getUserRealName({ ...base, preferred_name: 'Annie', first_name: 'Ann' })).toBe('Annie');
	});

	it('falls back to first + last name', () => {
		expect(getUserRealName({ ...base, first_name: 'Ann', last_name: 'Attendee' })).toBe(
			'Ann Attendee'
		);
	});

	it('falls back to first name alone', () => {
		expect(getUserRealName({ ...base, first_name: 'Ann' })).toBe('Ann');
	});

	it('never falls back to email — returns empty for a nameless user', () => {
		expect(getUserRealName(base)).toBe('');
	});

	it('stays empty when only null-ish fields are present', () => {
		expect(getUserRealName({ preferred_name: null, first_name: null, last_name: null })).toBe('');
	});

	it('treats whitespace-only fields as empty and trims composites', () => {
		expect(getUserRealName({ ...base, preferred_name: '   ' })).toBe('');
		expect(getUserRealName({ ...base, preferred_name: '  Annie  ' })).toBe('Annie');
		expect(getUserRealName({ ...base, first_name: ' Ann ', last_name: ' Attendee ' })).toBe(
			'Ann Attendee'
		);
		expect(getUserRealName({ ...base, first_name: '   ', last_name: 'Attendee' })).toBe('');
	});
});

describe('getUserDisplayName', () => {
	it('still bottoms out at email for pure display purposes', () => {
		expect(getUserDisplayName(base)).toBe('ann@example.com');
	});
});

describe('staffViewDisplayName', () => {
	it('prefers the backend display_name, which for an unknown holder is the name staff supplied', () => {
		const unknown = { known: false, display_name: 'Guest Gina', email: 'gina@example.com' };
		expect(staffViewDisplayName(unknown)).toBe('Guest Gina');
		// the legacy chain would have dropped the supplied name for the email
		expect(getUserDisplayName(unknown)).toBe('gina@example.com');
	});

	it('trims the display_name and skips a blank one', () => {
		expect(staffViewDisplayName({ display_name: '  Ann  ' })).toBe('Ann');
		expect(staffViewDisplayName({ display_name: '  ', first_name: 'Ann' })).toBe('Ann');
	});

	it('falls back to the legacy chain and then to the given fallback', () => {
		expect(staffViewDisplayName({ first_name: 'Ann', last_name: 'B' })).toBe('Ann B');
		expect(staffViewDisplayName({ display_name: null }, 'Nobody')).toBe('Nobody');
	});
});

describe('isUnknownHolder', () => {
	it('is true only for an explicit known: false', () => {
		expect(isUnknownHolder({ known: false })).toBe(true);
		expect(isUnknownHolder({ known: true })).toBe(false);
		expect(isUnknownHolder({})).toBe(false);
		expect(isUnknownHolder(null)).toBe(false);
		expect(isUnknownHolder(undefined)).toBe(false);
	});
});

describe('secondaryEmail', () => {
	it('returns the email when the name is something else', () => {
		expect(secondaryEmail({ display_name: 'Gina', email: 'gina@example.com' })).toBe(
			'gina@example.com'
		);
	});

	it('returns null when the name already is the email (no supplied name)', () => {
		expect(
			secondaryEmail({ display_name: 'gina@example.com', email: 'gina@example.com' })
		).toBeNull();
	});

	it('returns null when there is no email', () => {
		expect(secondaryEmail({ display_name: 'Gina', email: null })).toBeNull();
	});
});
