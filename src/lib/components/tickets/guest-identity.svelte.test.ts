import { describe, it, expect } from 'vitest';
import { GuestIdentity, guestIdentityError } from './guest-identity.svelte';

describe('GuestIdentity', () => {
	it('starts empty', () => {
		const identity = new GuestIdentity();
		expect(identity.email).toBe('');
		expect(identity.firstName).toBe('');
		expect(identity.lastName).toBe('');
	});

	it('trims email on write', () => {
		const identity = new GuestIdentity();
		identity.email = '  test@example.com  ';
		expect(identity.email).toBe('test@example.com');
	});

	it('trims firstName and lastName on write', () => {
		const identity = new GuestIdentity();
		identity.firstName = '  Jane  ';
		identity.lastName = '  Doe  ';
		expect(identity.firstName).toBe('Jane');
		expect(identity.lastName).toBe('Doe');
	});

	it('clear() resets every field to empty', () => {
		const identity = new GuestIdentity();
		identity.email = 'test@example.com';
		identity.firstName = 'Jane';
		identity.lastName = 'Doe';
		identity.clear();
		expect(identity.email).toBe('');
		expect(identity.firstName).toBe('');
		expect(identity.lastName).toBe('');
	});
});

describe('guestIdentityError', () => {
	it('returns "email" when the email is empty', () => {
		const identity = new GuestIdentity();
		expect(guestIdentityError(identity, false)).toBe('email');
	});

	it('returns "email" when the email is not a valid address', () => {
		const identity = new GuestIdentity();
		identity.email = 'not-an-email';
		expect(guestIdentityError(identity, false)).toBe('email');
	});

	it('returns null for a valid email when names are not required', () => {
		const identity = new GuestIdentity();
		identity.email = 'test@example.com';
		expect(guestIdentityError(identity, false)).toBeNull();
	});

	it('ignores blank first/last name when names are not required', () => {
		const identity = new GuestIdentity();
		identity.email = 'test@example.com';
		expect(guestIdentityError(identity, false)).toBeNull();
	});

	it('returns "names" when names are required and firstName is blank', () => {
		const identity = new GuestIdentity();
		identity.email = 'test@example.com';
		identity.lastName = 'Doe';
		expect(guestIdentityError(identity, true)).toBe('names');
	});

	it('returns "names" when names are required and lastName is blank', () => {
		const identity = new GuestIdentity();
		identity.email = 'test@example.com';
		identity.firstName = 'Jane';
		expect(guestIdentityError(identity, true)).toBe('names');
	});

	it('returns "names" when names are required and both are whitespace-only', () => {
		const identity = new GuestIdentity();
		identity.email = 'test@example.com';
		identity.firstName = '   ';
		identity.lastName = '   ';
		expect(guestIdentityError(identity, true)).toBe('names');
	});

	it('returns null when names are required and both are present', () => {
		const identity = new GuestIdentity();
		identity.email = 'test@example.com';
		identity.firstName = 'Jane';
		identity.lastName = 'Doe';
		expect(guestIdentityError(identity, true)).toBeNull();
	});

	it('checks email before names (email wins when both are invalid)', () => {
		const identity = new GuestIdentity();
		expect(guestIdentityError(identity, true)).toBe('email');
	});
});
