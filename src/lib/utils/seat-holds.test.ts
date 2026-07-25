import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	recordAnonymousHold,
	clearAnonymousHoldRecord,
	hasAnonymousHolds,
	releaseAnonymousHolds
} from './seat-holds';

vi.mock('$lib/config/api', () => ({
	API_BASE_URL: 'http://api.test'
}));

const STORAGE_KEY = 'revel:anon-seat-holds';

function storedIds(): string[] {
	const raw = window.sessionStorage.getItem(STORAGE_KEY);
	return raw ? (JSON.parse(raw) as string[]) : [];
}

describe('anonymous seat-hold registry', () => {
	beforeEach(() => {
		window.sessionStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('records event ids without duplicates', () => {
		recordAnonymousHold('event-1');
		recordAnonymousHold('event-2');
		recordAnonymousHold('event-1');
		expect(storedIds()).toEqual(['event-1', 'event-2']);
	});

	it('hasAnonymousHolds reflects the record', () => {
		expect(hasAnonymousHolds()).toBe(false);
		recordAnonymousHold('event-1');
		expect(hasAnonymousHolds()).toBe(true);
	});

	it('clearAnonymousHoldRecord removes a single event id', () => {
		recordAnonymousHold('event-1');
		recordAnonymousHold('event-2');
		clearAnonymousHoldRecord('event-1');
		expect(storedIds()).toEqual(['event-2']);
		clearAnonymousHoldRecord('event-2');
		expect(hasAnonymousHolds()).toBe(false);
	});

	it('survives a corrupted record', () => {
		window.sessionStorage.setItem(STORAGE_KEY, 'not-json{');
		expect(hasAnonymousHolds()).toBe(false);
		recordAnonymousHold('event-1');
		expect(storedIds()).toEqual(['event-1']);
	});

	describe('releaseAnonymousHolds', () => {
		it('does not fetch when nothing is recorded', async () => {
			const fetchMock = vi.fn();
			vi.stubGlobal('fetch', fetchMock);
			await releaseAnonymousHolds();
			expect(fetchMock).not.toHaveBeenCalled();
		});

		it('issues a cookie-authenticated DELETE per event, with NO Authorization header', async () => {
			const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
			vi.stubGlobal('fetch', fetchMock);
			recordAnonymousHold('event-1');
			recordAnonymousHold('event-2');

			await releaseAnonymousHolds();

			// The generated client invokes fetch with a single Request object.
			expect(fetchMock).toHaveBeenCalledTimes(2);
			const requests = fetchMock.mock.calls.map(([request]) => request as Request);
			expect(requests.map((request) => request.url)).toEqual([
				'http://api.test/api/events/event-1/seating/holds',
				'http://api.test/api/events/event-2/seating/holds'
			]);
			for (const request of requests) {
				expect(request.method).toBe('DELETE');
				expect(request.credentials).toBe('include');
				// IDENTITY CRITICAL: the guest-cookie identity must release the holds,
				// so no Authorization header may ever be attached.
				expect(request.headers.get('Authorization')).toBeNull();
			}
		});

		it('swallows failures and always clears the record', async () => {
			const fetchMock = vi
				.fn()
				.mockRejectedValueOnce(new TypeError('Failed to fetch'))
				.mockResolvedValueOnce(new Response(null, { status: 500 }));
			vi.stubGlobal('fetch', fetchMock);
			recordAnonymousHold('event-1');
			recordAnonymousHold('event-2');

			await expect(releaseAnonymousHolds()).resolves.toBeUndefined();

			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(hasAnonymousHolds()).toBe(false);
		});
	});
});
