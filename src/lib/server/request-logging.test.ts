import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Handle, HandleServerError, RequestEvent } from '@sveltejs/kit';

// Mock the logger + metrics so we can assert on calls without real I/O.
vi.mock('./logger', () => ({
	log: { debug: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() }
}));
vi.mock('./metrics', () => ({
	recordRequest: vi.fn(),
	recordSsrError: vi.fn()
}));

import { handleRequestLogging, handleSsrError, redactTokens } from './request-logging';
import { log } from './logger';
import { recordRequest, recordSsrError } from './metrics';

/** Build a minimal RequestEvent good enough for the hooks under test. */
function fakeEvent(overrides: Partial<RequestEvent> = {}): RequestEvent {
	const event = {
		request: new Request('https://letsrevel.io/login', {
			method: 'POST',
			headers: { 'user-agent': 'vitest-ua' }
		}),
		url: new URL('https://letsrevel.io/login'),
		route: { id: '/(public)/login' },
		locals: {},
		getClientAddress: () => '203.0.113.7',
		...overrides
	};
	return event as unknown as RequestEvent;
}

/** Invoke a Handle with a resolve that returns the given response. */
function invokeHandle(handle: Handle, event: RequestEvent, response: Response) {
	const resolve = vi.fn().mockResolvedValue(response);
	return { promise: handle({ event, resolve } as Parameters<Handle>[0]), resolve };
}

describe('handleRequestLogging', () => {
	beforeEach(() => vi.clearAllMocks());

	it('generates a request_id, stores it on locals, and echoes it on the response', async () => {
		const event = fakeEvent();
		const response = new Response('ok', { status: 303 });
		const { promise } = invokeHandle(handleRequestLogging, event, response);
		const result = await promise;

		expect(event.locals.requestId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
		);
		expect(result.headers.get('x-request-id')).toBe(event.locals.requestId);
	});

	it('emits request_finished with the contracted fields after resolve', async () => {
		const event = fakeEvent({
			locals: { user: { id: 'user-42', email: 'x@y.z' } } as RequestEvent['locals']
		});
		const response = new Response('ok', { status: 303 });
		await invokeHandle(handleRequestLogging, event, response).promise;

		expect(log.info).toHaveBeenCalledTimes(1);
		const [eventName, fields] = vi.mocked(log.info).mock.calls[0];
		expect(eventName).toBe('request_finished');
		expect(fields).toMatchObject({
			method: 'POST',
			path: '/login',
			route_id: '/(public)/login',
			status_code: 303,
			request_id: event.locals.requestId,
			user_id: 'user-42',
			ip_address: '203.0.113.7',
			user_agent: 'vitest-ua'
		});
		expect(typeof fields?.duration_ms).toBe('number');
		expect(fields?.duration_ms).toBeGreaterThanOrEqual(0);
	});

	it.each([500, 502, 503])('logs request_finished at error level for a %i', async (status) => {
		const response = new Response('boom', { status });
		await invokeHandle(handleRequestLogging, fakeEvent(), response).promise;

		expect(log.info).not.toHaveBeenCalled();
		expect(log.error).toHaveBeenCalledTimes(1);
		const [eventName, fields] = vi.mocked(log.error).mock.calls[0];
		expect(eventName).toBe('request_finished');
		expect(fields).toMatchObject({ status_code: status });
	});

	it.each([200, 401, 404, 499])('logs request_finished at info level for a %i', async (status) => {
		const response = new Response(null, { status });
		await invokeHandle(handleRequestLogging, fakeEvent(), response).promise;

		expect(log.error).not.toHaveBeenCalled();
		expect(log.info).toHaveBeenCalledWith(
			'request_finished',
			expect.objectContaining({ status_code: status })
		);
	});

	it('records the HTTP request metric with the route id', async () => {
		const event = fakeEvent();
		await invokeHandle(handleRequestLogging, event, new Response('ok', { status: 200 })).promise;
		expect(recordRequest).toHaveBeenCalledWith(
			expect.objectContaining({ method: 'POST', status: 200, route: '/(public)/login' })
		);
	});

	it('omits ip_address when getClientAddress throws (prerender)', async () => {
		const event = fakeEvent({
			getClientAddress: () => {
				throw new Error('prerendering');
			}
		});
		await invokeHandle(handleRequestLogging, event, new Response('ok')).promise;
		const [, fields] = vi.mocked(log.info).mock.calls[0];
		expect(fields?.ip_address).toBeUndefined();
	});

	it('still returns the response when logging throws (never breaks the request)', async () => {
		vi.mocked(log.info).mockImplementationOnce(() => {
			throw new Error('logger exploded');
		});
		const event = fakeEvent();
		const response = new Response('ok', { status: 200 });
		const result = await invokeHandle(handleRequestLogging, event, response).promise;
		expect(result).toBe(response);
	});
});

describe('handleSsrError', () => {
	beforeEach(() => vi.clearAllMocks());

	it('increments the SSR error metric and logs at error level with context', () => {
		const event = fakeEvent({ locals: { requestId: 'req-1' } as RequestEvent['locals'] });
		const boom = new Error('render failed');
		const result = (handleSsrError as HandleServerError)({
			error: boom,
			event,
			status: 500,
			message: 'Internal Error'
		});

		expect(recordSsrError).toHaveBeenCalledWith('/(public)/login');
		expect(log.error).toHaveBeenCalledWith(
			'unhandled_ssr_error',
			expect.objectContaining({
				error: boom,
				route_id: '/(public)/login',
				path: '/login',
				method: 'POST',
				status_code: 500,
				request_id: 'req-1',
				ip_address: '203.0.113.7',
				user_agent: 'vitest-ua'
			})
		);
		expect(log.warning).not.toHaveBeenCalled();
		expect(result).toEqual({ message: 'Internal Error' });
	});

	it('does NOT count 4xx (scanner 404s) into the metric and logs them at warning', () => {
		const event = fakeEvent({
			url: new URL('https://letsrevel.io/w3lls.php'),
			route: { id: null } as RequestEvent['route'],
			locals: { requestId: 'req-2' } as RequestEvent['locals']
		});
		const result = (handleSsrError as HandleServerError)({
			error: new Error('Not Found'),
			event,
			status: 404,
			message: 'Not Found'
		});

		expect(recordSsrError).not.toHaveBeenCalled();
		expect(log.error).not.toHaveBeenCalled();
		expect(log.warning).toHaveBeenCalledWith(
			'ssr_client_error',
			expect.objectContaining({
				route_id: null,
				path: '/w3lls.php',
				status_code: 404,
				request_id: 'req-2',
				ip_address: '203.0.113.7',
				user_agent: 'vitest-ua'
			})
		);
		expect(result).toEqual({ message: 'Not Found' });
	});

	it('redacts tokens in Error-shaped plain objects', () => {
		const event = fakeEvent({
			url: new URL('https://letsrevel.io/join/event/SECRET'),
			route: { id: null } as RequestEvent['route'],
			locals: { requestId: 'req-4' } as RequestEvent['locals']
		});
		(handleSsrError as HandleServerError)({
			error: { name: 'ApiError', message: 'Not found: /join/event/SECRET' },
			event,
			status: 404,
			message: 'Not Found'
		});
		const [, fields] = vi.mocked(log.warning).mock.calls[0];
		expect(JSON.stringify(fields)).not.toContain('SECRET');
	});

	it('omits ip_address when getClientAddress throws (prerender)', () => {
		const event = fakeEvent({
			locals: { requestId: 'req-3' } as RequestEvent['locals'],
			getClientAddress: () => {
				throw new Error('prerendering');
			}
		});
		(handleSsrError as HandleServerError)({
			error: new Error('render failed'),
			event,
			status: 500,
			message: 'Internal Error'
		});
		const [, fields] = vi.mocked(log.error).mock.calls[0];
		expect(fields?.ip_address).toBeUndefined();
	});
});

describe('redactTokens', () => {
	it('redacts token route params and leaves other paths alone', () => {
		expect(redactTokens('/join/org/abc123', { token_id: 'abc123' })).toBe('/join/org/REDACTED');
		expect(redactTokens('/join/event/abc123/', { token_id: 'abc123' })).toBe(
			'/join/event/REDACTED/'
		);
		expect(redactTokens('/events/acme/party', { org_slug: 'acme', event_slug: 'party' })).toBe(
			'/events/acme/party'
		);
		expect(redactTokens('/login', {})).toBe('/login');
	});

	it('redacts invitation paths even when params are empty (404/400 routes)', () => {
		expect(redactTokens('/join/event/tok/extra', {})).toBe('/join/event/REDACTED/extra');
		expect(redactTokens('Not found: /join/org/tok', {})).toBe('Not found: /join/org/REDACTED');
	});

	it('redacts non-canonical encodings via the regex fallback', () => {
		expect(redactTokens('/join/event/%61bc123', { token_id: 'abc123' })).toBe(
			'/join/event/REDACTED'
		);
	});

	it('scrubs the token from the error logged by handleSsrError', () => {
		vi.clearAllMocks();
		const error = new Error('Not found: /join/event/secret/extra');
		(handleSsrError as HandleServerError)({
			error,
			event: fakeEvent({ url: new URL('https://letsrevel.io/join/event/secret/extra') }),
			status: 404,
			message: 'Not Found'
		});
		const ctx = vi.mocked(log.warning).mock.calls[0][1] as { error: Error };
		expect(JSON.stringify(ctx)).not.toContain('secret');
		expect(ctx.error).toBeInstanceOf(Error);
		expect(ctx.error.message).toContain('REDACTED');
		expect(ctx.error.stack).not.toContain('secret');
		expect(error.message).toContain('secret'); // original untouched
	});

	it('handles URL-encoded param values', () => {
		expect(redactTokens('/join/org/a%2Fb%20c', { token_id: 'a/b c' })).toBe('/join/org/REDACTED');
	});

	it('is applied to request_finished and ssr error logs', async () => {
		vi.clearAllMocks();
		const url = new URL('https://letsrevel.io/join/event/secret-token');
		const params = { token_id: 'secret-token' };
		await handleRequestLogging({
			event: fakeEvent({ url, params }),
			resolve: vi.fn().mockResolvedValue(new Response('ok'))
		} as Parameters<Handle>[0]);
		expect(vi.mocked(log.info).mock.calls[0][1]).toMatchObject({
			path: '/join/event/REDACTED'
		});
		(handleSsrError as HandleServerError)({
			error: new Error('x'),
			event: fakeEvent({ url, params }),
			status: 500,
			message: 'm'
		});
		expect(vi.mocked(log.error).mock.calls[0][1]).toMatchObject({ path: '/join/event/REDACTED' });
	});
});
