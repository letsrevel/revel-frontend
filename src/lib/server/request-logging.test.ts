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

import { handleRequestLogging, handleSsrError } from './request-logging';
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
				request_id: 'req-1'
			})
		);
		expect(result).toEqual({ message: 'Internal Error' });
	});
});
