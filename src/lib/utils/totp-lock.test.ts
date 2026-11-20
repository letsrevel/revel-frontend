import { describe, it, expect } from 'vitest';
import {
	retryAfterToSeconds,
	retryAfterToMinutes,
	classifyOtpFailure,
	totpLockedMessage
} from './totp-lock';

describe('retryAfterToMinutes', () => {
	it.each([
		['900', 15],
		['899', 15],
		['61', 2],
		['60', 1],
		['1', 1],
		[' 120 ', 2]
	])('%s seconds -> %i minutes', (input, expected) => {
		expect(retryAfterToMinutes(input)).toBe(expected);
	});

	it.each([
		null,
		undefined,
		'',
		'0',
		'-5',
		'abc',
		'1.5',
		'Wed, 21 Oct 2026 07:28:00 GMT',
		'999999999'
	])('returns null for %s', (input) => {
		expect(retryAfterToMinutes(input)).toBeNull();
	});
});

describe('classifyOtpFailure', () => {
	it('recognises the lock by code', () => {
		expect(classifyOtpFailure({ status: 429 }, { detail: 'x', code: 'totp_locked' })).toBe(
			'locked'
		);
	});
	it('treats a 429 without the code as throttling', () => {
		expect(classifyOtpFailure({ status: 429 }, { detail: 'x' })).toBe('throttled');
		expect(classifyOtpFailure({ status: 429 }, { code: 'other' })).toBe('throttled');
	});
	it('ignores a totp_locked body on a non-429 status', () => {
		expect(classifyOtpFailure({ status: 500 }, { code: 'totp_locked' })).toBeNull();
	});
	it('ignores other statuses', () => {
		expect(classifyOtpFailure({ status: 401 }, { code: 'totp_locked' })).toBeNull();
		expect(classifyOtpFailure(undefined, undefined)).toBeNull();
	});
});

describe('totpLockedMessage', () => {
	it('includes minutes from Retry-After', () => {
		const msg = totpLockedMessage({ headers: new Headers({ 'Retry-After': '600' }) });
		expect(msg).toBe(
			'Two-factor verification is paused for your security. Try again in 10 minutes.'
		);
	});
	it('falls back to a message without a number', () => {
		const msg = totpLockedMessage({ headers: new Headers() });
		expect(msg).not.toMatch(/\d/);
	});
});

describe('retryAfterToSeconds', () => {
	it('parses whole seconds', () => {
		expect(retryAfterToSeconds('300')).toBe(300);
		expect(retryAfterToSeconds(' 45 ')).toBe(45);
	});
	it.each([null, undefined, '', '0', 'abc', '999999999'])('returns null for %s', (input) => {
		expect(retryAfterToSeconds(input)).toBeNull();
	});
});
