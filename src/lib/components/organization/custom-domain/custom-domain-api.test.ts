import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmincustomdomainGetCustomDomain: vi.fn(),
	organizationadmincustomdomainRequestCustomDomain: vi.fn(),
	organizationadmincustomdomainRefreshCustomDomain: vi.fn(),
	organizationadmincustomdomainDeleteCustomDomain: vi.fn()
}));

import {
	organizationadmincustomdomainDeleteCustomDomain,
	organizationadmincustomdomainGetCustomDomain,
	organizationadmincustomdomainRefreshCustomDomain,
	organizationadmincustomdomainRequestCustomDomain
} from '$lib/api/generated/sdk.gen';
import {
	CustomDomainApiError,
	deleteCustomDomain,
	domainStatusTone,
	getCustomDomain,
	normalizeHostname,
	refreshCustomDomain,
	requestCustomDomain
} from './custom-domain-api';

// The SDK's result type is a large union; these tests only need the shape the
// adapter reads (`data` / `error` / `response.status`).
function result(value: { data?: unknown; error?: unknown; status?: number }) {
	return { ...value, response: { status: value.status ?? 200 } } as never;
}

describe('normalizeHostname', () => {
	it.each([
		['  Events.Example.COM ', 'events.example.com'],
		['https://events.example.com', 'events.example.com'],
		['HTTP://events.example.com/', 'events.example.com'],
		['events.example.com//', 'events.example.com'],
		['', '']
	])('%j -> %j', (input, expected) => {
		expect(normalizeHostname(input)).toBe(expected);
	});
});

describe('domainStatusTone', () => {
	it('maps pending to warning, active to success, failed to danger', () => {
		expect(domainStatusTone('pending')).toBe('warning');
		expect(domainStatusTone('active')).toBe('success');
		expect(domainStatusTone('failed')).toBe('danger');
	});
});

describe('adapter error mapping', () => {
	beforeEach(() => vi.clearAllMocks());

	it('read: returns null when the org has no domain', async () => {
		vi.mocked(organizationadmincustomdomainGetCustomDomain).mockResolvedValue(
			result({ data: null })
		);
		await expect(getCustomDomain('acme')).resolves.toBeNull();
	});

	it('request: 400 errors.hostname (string or list) keyed by field name', async () => {
		vi.mocked(organizationadmincustomdomainRequestCustomDomain).mockResolvedValue(
			result({ error: { errors: { hostname: ['one', 'two'] } }, status: 400 })
		);
		const err = await requestCustomDomain('acme', 'x').catch((e: unknown) => e);
		expect(err).toBeInstanceOf(CustomDomainApiError);
		expect((err as CustomDomainApiError).fieldErrors).toEqual(['one', 'two']);

		vi.mocked(organizationadmincustomdomainRequestCustomDomain).mockResolvedValue(
			result({ error: { errors: { hostname: 'single' } }, status: 400 })
		);
		const single = await requestCustomDomain('acme', 'x').catch((e: unknown) => e);
		expect((single as CustomDomainApiError).fieldErrors).toEqual(['single']);
	});

	it('request: 409 and 502 carry the detail, not field errors', async () => {
		vi.mocked(organizationadmincustomdomainRequestCustomDomain).mockResolvedValue(
			result({ error: { detail: 'In use' }, status: 409 })
		);
		const err = (await requestCustomDomain('acme', 'x').catch(
			(e: unknown) => e
		)) as CustomDomainApiError;
		expect(err.status).toBe(409);
		expect(err.detail).toBe('In use');
		expect(err.fieldErrors).toEqual([]);
	});

	it('refresh and delete throw on error', async () => {
		vi.mocked(organizationadmincustomdomainRefreshCustomDomain).mockResolvedValue(
			result({ error: { detail: 'Bad gateway' }, status: 502 })
		);
		await expect(refreshCustomDomain('acme')).rejects.toMatchObject({ status: 502 });

		vi.mocked(organizationadmincustomdomainDeleteCustomDomain).mockResolvedValue(
			result({ error: { detail: 'Not found' }, status: 404 })
		);
		await expect(deleteCustomDomain('acme')).rejects.toMatchObject({ status: 404 });
	});

	it('delete resolves on 204 (no data, no error)', async () => {
		vi.mocked(organizationadmincustomdomainDeleteCustomDomain).mockResolvedValue(
			result({ status: 204 })
		);
		await expect(deleteCustomDomain('acme')).resolves.toBeUndefined();
	});
});
