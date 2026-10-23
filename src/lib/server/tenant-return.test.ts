import { describe, it, expect, vi, beforeEach } from 'vitest';

const byDomain = vi.hoisted(() => vi.fn());
vi.mock('$lib/api', () => ({ organizationGetOrganizationCustomDomain: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({ organizationGetOrganizationByDomain: byDomain }));
const mockEnv = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => mockEnv);
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import { __resetTenantCache } from './tenant';
import { resolveReturnHost, resolveReturnTarget } from './tenant-canonical';

const f = vi.fn() as unknown as typeof globalThis.fetch;
const found = (name = 'Acme') => ({ data: { id: 'o1', name }, response: { status: 200 } });

beforeEach(() => {
	mockEnv.env.PLATFORM_HOSTS = 'app.example.com';
	__resetTenantCache();
	byDomain.mockReset();
	byDomain.mockResolvedValue(found());
});

describe('resolveReturnHost (#1070)', () => {
	it('returns the custom-domain origin for an active tenant', async () => {
		expect(await resolveReturnHost('events.acme.org', f)).toBe('https://events.acme.org');
		expect(byDomain).toHaveBeenCalledOnce();
	});

	it('normalizes case and exposes the org name', async () => {
		expect(await resolveReturnTarget('Events.Acme.ORG', f)).toEqual({
			origin: 'https://events.acme.org',
			name: 'Acme'
		});
	});

	it('is null for an unknown host', async () => {
		byDomain.mockResolvedValue({ error: {}, response: { status: 404 } });
		expect(await resolveReturnHost('nope.example.org', f)).toBeNull();
	});

	it('is null for an inactive tenant (the by-domain lookup 404s)', async () => {
		byDomain.mockResolvedValue({ error: { detail: 'Not found' }, response: { status: 404 } });
		expect(await resolveReturnHost('inactive.example.org', f)).toBeNull();
	});

	it('is null when the lookup is unavailable', async () => {
		byDomain.mockRejectedValue(new Error('down'));
		expect(await resolveReturnHost('events.acme.org', f)).toBeNull();
	});

	it('is null, without a lookup, while tenant mode is off', async () => {
		mockEnv.env.PLATFORM_HOSTS = undefined;
		expect(await resolveReturnHost('events.acme.org', f)).toBeNull();
		expect(byDomain).not.toHaveBeenCalled();
	});

	it.each([
		['path', 'evil.com/x'],
		['userinfo', 'a@b'],
		['userinfo + host', 'good.org@evil.com'],
		['port', 'host:8080'],
		['scheme', 'https://x'],
		['scheme-relative', '//evil.com'],
		['query', 'evil.com?x=1'],
		['fragment', 'evil.com#x'],
		['backslash', 'evil.com\\x'],
		['whitespace', 'evil.com x'],
		['underscore', 'a_b.org'],
		['empty', '']
	])('rejects a malformed value without a lookup (%s)', async (_label, raw) => {
		expect(await resolveReturnHost(raw, f)).toBeNull();
		expect(byDomain).not.toHaveBeenCalled();
	});

	it('is null for null / undefined', async () => {
		expect(await resolveReturnHost(null, f)).toBeNull();
		expect(await resolveReturnHost(undefined, f)).toBeNull();
	});

	it('never returns a platform host', async () => {
		expect(await resolveReturnHost('app.example.com', f)).toBeNull();
		expect(await resolveReturnHost('APP.example.com', f)).toBeNull();
		expect(await resolveReturnHost('localhost', f)).toBeNull();
		expect(byDomain).not.toHaveBeenCalled();
	});
});
