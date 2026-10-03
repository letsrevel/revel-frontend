import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	SERVER_ACCEPT_ENCODING,
	applyServerAcceptEncoding,
	hasUndecodableEncoding,
	retryUndecodable
} from './encoding';

afterEach(() => vi.unstubAllGlobals());

describe('server accept-encoding', () => {
	it('never advertises zstd', () => {
		expect(SERVER_ACCEPT_ENCODING).not.toContain('zstd');
	});

	it('overrides a zstd-capable header', () => {
		const req = new Request('https://api.example/x', {
			headers: { 'accept-encoding': 'gzip, deflate, br, zstd' }
		});
		applyServerAcceptEncoding(req);
		expect(req.headers.get('accept-encoding')).toBe(SERVER_ACCEPT_ENCODING);
	});
});

describe('retryUndecodable', () => {
	const req = () => new Request('https://api.example/x');

	it('detects zstd content-encoding', () => {
		expect(
			hasUndecodableEncoding(new Response('x', { headers: { 'content-encoding': 'zstd' } }))
		).toBe(true);
		expect(
			hasUndecodableEncoding(new Response('x', { headers: { 'content-encoding': 'gzip' } }))
		).toBe(false);
	});

	it('passes decodable responses through untouched', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const res = new Response('{}');
		expect(await retryUndecodable(res, req())).toBe(res);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('re-requests zstd responses with identity encoding', async () => {
		const good = new Response('{}');
		const fetchMock = vi.fn().mockResolvedValue(good);
		vi.stubGlobal('fetch', fetchMock);
		const bad = new Response('garbage', { headers: { 'content-encoding': 'zstd' } });
		expect(await retryUndecodable(bad, req())).toBe(good);
		expect(fetchMock.mock.calls[0][0].headers.get('accept-encoding')).toBe('identity');
	});

	it('does not retry non-idempotent requests', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const bad = new Response('garbage', { headers: { 'content-encoding': 'zstd' } });
		expect(
			await retryUndecodable(bad, new Request('https://a/x', { method: 'POST', body: '{}' }))
		).toBe(bad);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
