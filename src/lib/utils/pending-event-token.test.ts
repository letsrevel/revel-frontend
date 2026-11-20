import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { forgetPendingEventToken } from './pending-event-token';

describe('forgetPendingEventToken', () => {
	const fetchMock = vi.fn();
	let warn: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
		warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		warn.mockRestore();
	});

	it('sends an encoded DELETE with a timeout signal', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
		await forgetPendingEventToken('et 1/x');

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/events/pending-token?token=et%201%2Fx');
		expect(init.method).toBe('DELETE');
		expect(init.signal).toBeInstanceOf(AbortSignal);
		expect(warn).not.toHaveBeenCalled();
	});

	it('still sends the DELETE where AbortSignal.timeout is missing', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
		const original = AbortSignal.timeout;
		// @ts-expect-error -- simulate an older browser
		AbortSignal.timeout = undefined;
		try {
			await forgetPendingEventToken('et-1');
		} finally {
			AbortSignal.timeout = original;
		}
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
		expect(warn).not.toHaveBeenCalled();
	});

	it('warns, and does not throw, when the server does not clear the token', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 405 }));
		await expect(forgetPendingEventToken('et-1')).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledWith(expect.any(String), 405);
	});

	it('warns, and does not throw, on a network error or timeout', async () => {
		fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
		await expect(forgetPendingEventToken('et-1')).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalled();
	});
});
