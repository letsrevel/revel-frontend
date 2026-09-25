import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHttpError } from '@sveltejs/kit';

vi.mock('./logger', () => ({
	log: { debug: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() }
}));

import { throwIfTransientUpstream, throwIfUpstreamFailed } from './upstream';
import { log } from './logger';

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

describe('throwIfUpstreamFailed', () => {
	beforeEach(() => vi.clearAllMocks());

	function statusThrownForResult(result: { error?: unknown; response?: Response }): number | null {
		try {
			throwIfUpstreamFailed('thing_failed', result, 'Failed', { item_id: 'i-1' });
			return null;
		} catch (err) {
			if (isHttpError(err)) return err.status;
			throw err;
		}
	}

	it.each([200, 201, 204])('returns normally and logs nothing for an upstream %i', (status) => {
		expect(statusThrownForResult({ response: new Response(null, { status }) })).toBeNull();
		expect(log.warning).not.toHaveBeenCalled();
		expect(log.error).not.toHaveBeenCalled();
	});

	it.each([400, 401, 403, 404, 422])(
		'passes an upstream %i through and logs it at warning with the body',
		(status) => {
			const body = { detail: 'You do not have permission to perform this action.' };
			const result = { error: body, response: new Response(null, { status }) };

			expect(statusThrownForResult(result)).toBe(status);
			expect(log.error).not.toHaveBeenCalled();
			expect(log.warning).toHaveBeenCalledWith('thing_failed', {
				item_id: 'i-1',
				upstream_status: status,
				upstream_error: body
			});
		}
	);

	it.each([500, 502, 503])('maps an upstream %i to 502 and logs it at error', (status) => {
		const result = { error: 'boom', response: new Response(null, { status }) };

		expect(statusThrownForResult(result)).toBe(502);
		expect(log.error).toHaveBeenCalledWith('thing_failed', {
			item_id: 'i-1',
			upstream_status: status,
			upstream_error: 'boom'
		});
	});

	it('maps a missing response (network-level failure) to 502', () => {
		expect(statusThrownForResult({ error: new TypeError('fetch failed') })).toBe(502);
		expect(log.error).toHaveBeenCalledOnce();
	});

	it('never logs the request (it carries the Authorization header)', () => {
		const result = {
			error: { detail: 'nope' },
			request: new Request('https://api.example/x', {
				headers: { Authorization: 'Bearer secret-token' }
			}),
			response: new Response(null, { status: 403 })
		};

		statusThrownForResult(result);
		expect(JSON.stringify(vi.mocked(log.warning).mock.calls)).not.toContain('secret-token');
	});
});
