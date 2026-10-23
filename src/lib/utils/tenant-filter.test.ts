import { describe, it, expect } from 'vitest';
import { tenantOrgFilter } from './tenant-filter';

describe('tenantOrgFilter', () => {
	it('returns an empty filter on the platform host', () => {
		expect(tenantOrgFilter({ tenant: null })).toEqual({});
		expect(tenantOrgFilter({})).toEqual({});
		expect(tenantOrgFilter(undefined)).toEqual({});
		expect(tenantOrgFilter(null)).toEqual({});
	});

	it('returns the tenant organization id on a tenant host', () => {
		expect(tenantOrgFilter({ tenant: { id: 'org-1' } })).toEqual({ organization: 'org-1' });
	});

	it('produces distinct cache-key fragments for tenant and platform', () => {
		expect(JSON.stringify(tenantOrgFilter({ tenant: { id: 'a' } }))).not.toBe(
			JSON.stringify(tenantOrgFilter({ tenant: null }))
		);
	});
});
