import { describe, expect, it } from 'vitest';
import { MAX_QUERY_RETRIES, shouldRetry } from './query-retry';

describe('shouldRetry', () => {
	it.each([401, 403, 404])('never retries an error with status %i', (status) => {
		expect(shouldRetry(0, { status })).toBe(false);
		expect(shouldRetry(1, { status })).toBe(false);
	});

	it('retries a 500 until the retry budget is spent', () => {
		expect(MAX_QUERY_RETRIES).toBe(2);
		expect(shouldRetry(0, { status: 500 })).toBe(true);
		expect(shouldRetry(1, { status: 500 })).toBe(true);
		expect(shouldRetry(2, { status: 500 })).toBe(false);
	});

	it('retries errors without a numeric status (network failures, plain bodies)', () => {
		expect(shouldRetry(0, new Error('network'))).toBe(true);
		expect(shouldRetry(0, { detail: 'x' })).toBe(true);
		expect(shouldRetry(0, { status: '404' })).toBe(true);
		expect(shouldRetry(0, null)).toBe(true);
		expect(shouldRetry(2, new Error('network'))).toBe(false);
	});
});
