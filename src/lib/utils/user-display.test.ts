import { describe, it, expect } from 'vitest';
import { getUserDisplayName, getUserRealName } from './user-display';

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
