import { describe, it, expect } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { throwIfTransientUpstream } from './upstream';

function statusThrownFor(response: Response | undefined): number | null {
	try {
		throwIfTransientUpstream(response);
		return null;
	} catch (err) {
		if (isHttpError(err)) return err.status;
		throw err;
	}
}

describe('throwIfTransientUpstream', () => {
	it('throws 503 for an upstream 429', () => {
		expect(statusThrownFor(new Response(null, { status: 429 }))).toBe(503);
	});

	it.each([500, 502, 503, 504])('throws 503 for an upstream %i', (status) => {
		expect(statusThrownFor(new Response(null, { status }))).toBe(503);
	});

	it.each([200, 401, 403, 404, 410, 422])('returns normally for an upstream %i', (status) => {
		expect(statusThrownFor(new Response(null, { status }))).toBeNull();
	});

	it('returns normally when there is no response (network-level failure)', () => {
		expect(statusThrownFor(undefined)).toBeNull();
	});
});
