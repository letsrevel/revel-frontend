import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/config/api', () => ({ API_BASE_URL: 'https://api.example.com' }));

import { forwardTenantOrigin, prepareApiRequest } from './tenant-fetch';

const API = 'https://api.example.com/api/account/register';
const tenantEvent = {
	locals: { tenant: { slug: 'acme' } },
	url: new URL('https://events.acme.org/register?x=1')
};
const platformEvent = {
	locals: { tenant: null },
	url: new URL('https://app.example.com/register')
};

describe('forwardTenantOrigin (#1070)', () => {
	it('sets Origin to the tenant public origin on API calls from a tenant host', () => {
		const req = new Request(API, { method: 'POST' });
		forwardTenantOrigin(tenantEvent, req, true);
		expect(req.headers.get('origin')).toBe('https://events.acme.org');
	});

	it('leaves platform-host requests untouched', () => {
		const req = new Request(API, { method: 'POST' });
		forwardTenantOrigin(platformEvent, req, true);
		expect(req.headers.has('origin')).toBe(false);
	});

	it('leaves non-API requests untouched', () => {
		const req = new Request('https://other.example.net/thing');
		forwardTenantOrigin(tenantEvent, req, false);
		expect(req.headers.has('origin')).toBe(false);
	});

	it('keeps an Origin that is already set', () => {
		const req = new Request(API, { headers: { origin: 'https://already.example' } });
		forwardTenantOrigin(tenantEvent, req, true);
		expect(req.headers.get('origin')).toBe('https://already.example');
	});
});

describe('prepareApiRequest', () => {
	it('detects API requests and forwards the tenant origin to them', () => {
		const req = new Request(API);
		expect(prepareApiRequest(tenantEvent, req)).toBe(true);
		expect(req.headers.get('origin')).toBe('https://events.acme.org');
	});

	it('reports non-API requests and does not touch them', () => {
		const req = new Request('https://other.example.net/x');
		expect(prepareApiRequest(tenantEvent, req)).toBe(false);
		expect(req.headers.has('origin')).toBe(false);
	});
});
