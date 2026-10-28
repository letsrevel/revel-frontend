import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	applyGuestHoldHeader,
	captureGuestHoldToken,
	clearGuestHoldToken,
	getGuestHoldToken,
	rememberGuestHoldToken,
	rememberGuestHoldTokenFrom
} from './guest-hold';

const KEY = 'revel:guest-hold-token';
const BASE = 'http://api.test';

function req(path: string, method = 'GET'): Request {
	return new Request(`${BASE}${path}`, { method });
}

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

describe('guest-hold token store', () => {
	beforeEach(() => {
		window.sessionStorage.clear();
		clearGuestHoldToken();
	});
	afterEach(() => vi.restoreAllMocks());

	it('stores in memory and sessionStorage', () => {
		rememberGuestHoldToken('a');
		expect(getGuestHoldToken()).toBe('a');
		expect(window.sessionStorage.getItem(KEY)).toBe('a');
	});

	it('is a no-op on null/undefined and replaces on a new value', () => {
		rememberGuestHoldToken('a');
		rememberGuestHoldToken(null);
		rememberGuestHoldToken(undefined);
		expect(getGuestHoldToken()).toBe('a');
		rememberGuestHoldToken('b');
		expect(getGuestHoldToken()).toBe('b');
		expect(window.sessionStorage.getItem(KEY)).toBe('b');
	});

	it('clear removes both layers', () => {
		rememberGuestHoldToken('a');
		clearGuestHoldToken();
		expect(getGuestHoldToken()).toBeNull();
		expect(window.sessionStorage.getItem(KEY)).toBeNull();
	});

	it('hydrates from sessionStorage', () => {
		window.sessionStorage.setItem(KEY, 'persisted');
		expect(getGuestHoldToken()).toBe('persisted');
	});

	it('survives storage throwing', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('denied');
		});
		vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
			throw new Error('denied');
		});
		expect(() => rememberGuestHoldToken('mem')).not.toThrow();
		expect(getGuestHoldToken()).toBe('mem');
		expect(() => clearGuestHoldToken()).not.toThrow();
		expect(getGuestHoldToken()).toBeNull();
	});

	it('reads the token from a body, ignoring bad shapes', () => {
		rememberGuestHoldTokenFrom({ guest_hold_token: 't1' });
		expect(getGuestHoldToken()).toBe('t1');
		rememberGuestHoldTokenFrom({ guest_hold_token: null });
		rememberGuestHoldTokenFrom({ guest_hold_token: 5 });
		rememberGuestHoldTokenFrom('x');
		rememberGuestHoldTokenFrom(null);
		rememberGuestHoldTokenFrom({});
		expect(getGuestHoldToken()).toBe('t1');
	});
});

describe('applyGuestHoldHeader', () => {
	beforeEach(() => {
		clearGuestHoldToken();
		window.sessionStorage.clear();
	});

	it.each([
		['/api/events/e1/seating/availability', 'GET'],
		['/api/events/e1/seating/holds', 'POST'],
		['/api/events/e1/seating/holds', 'DELETE'],
		['/api/events/e1/seating/holds/best-available', 'POST'],
		['/api/events/e1/checkout/public', 'POST'],
		['/api/events/e1/rsvp/yes/public', 'POST'],
		['/api/events/guest-actions/confirm', 'POST']
	])('adds the header for anonymous %s %s', (path, method) => {
		rememberGuestHoldToken('tok');
		expect(applyGuestHoldHeader(req(path, method), true).headers.get('X-Guest-Hold')).toBe('tok');
	});

	it('never sends it for authenticated callers', () => {
		rememberGuestHoldToken('tok');
		const r = applyGuestHoldHeader(req('/api/events/e1/seating/holds', 'POST'), false);
		expect(r.headers.get('X-Guest-Hold')).toBeNull();
	});

	it('sends nothing without a stored token', () => {
		const r = applyGuestHoldHeader(req('/api/events/e1/seating/holds', 'POST'), true);
		expect(r.headers.get('X-Guest-Hold')).toBeNull();
	});

	it('leaves other endpoints alone', () => {
		rememberGuestHoldToken('tok');
		for (const path of ['/api/events/e1/seating/chart', '/api/events/', '/api/auth/token']) {
			expect(applyGuestHoldHeader(req(path), true).headers.get('X-Guest-Hold')).toBeNull();
		}
	});
});

describe('captureGuestHoldToken', () => {
	beforeEach(() => {
		clearGuestHoldToken();
		window.sessionStorage.clear();
	});

	it('captures from a 200 hold body and leaves the response readable', async () => {
		const res = json({ guest_hold_token: 'new' }, 200);
		await captureGuestHoldToken(res, req('/api/events/e1/seating/holds', 'POST'));
		expect(getGuestHoldToken()).toBe('new');
		expect(await res.json()).toEqual({ guest_hold_token: 'new' });
	});

	it('captures from a 409 body and from best-available', async () => {
		await captureGuestHoldToken(
			json({ guest_hold_token: 'c409' }, 409),
			req('/api/events/e1/seating/holds/best-available', 'POST')
		);
		expect(getGuestHoldToken()).toBe('c409');
	});

	it('replaces an older token and keeps it on null', async () => {
		rememberGuestHoldToken('old');
		const holds = req('/api/events/e1/seating/holds', 'POST');
		await captureGuestHoldToken(json({ guest_hold_token: 'fresh' }, 200), holds);
		expect(getGuestHoldToken()).toBe('fresh');
		await captureGuestHoldToken(json({ guest_hold_token: null }, 200), holds);
		expect(getGuestHoldToken()).toBe('fresh');
	});

	it('ignores other endpoints, methods, and non-JSON bodies', async () => {
		const body = { guest_hold_token: 'x' };
		await captureGuestHoldToken(json(body, 200), req('/api/events/e1/seating/holds', 'DELETE'));
		await captureGuestHoldToken(json(body, 200), req('/api/other', 'POST'));
		await captureGuestHoldToken(
			new Response('nope', { status: 500 }),
			req('/api/events/e1/seating/holds', 'POST')
		);
		expect(getGuestHoldToken()).toBeNull();
	});
});
