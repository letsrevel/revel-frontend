import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ org: vi.fn() }));
vi.mock('$lib/api', () => ({
	organizationGetOrganization: (...a: unknown[]) => api.org(...a),
	permissionMyPermissions: vi.fn(),
	organizationListResources: vi.fn(async () => ({ data: { results: [] } })),
	organizationGetOrganizationTokenDetails: vi.fn(),
	organizationListMembershipPlans: vi.fn(async () => ({ data: [] }))
}));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn(), warning: vi.fn() } }));
vi.mock('$lib/server/tenant-canonical', () => ({
	canonicalTenantRedirect: vi.fn(),
	serverLinkContext: vi.fn(() => ({ tenant: null, customDomains: { enabled: false } }))
}));
vi.mock('$lib/seo/server', () => ({ resolveLang: () => 'en' }));
vi.mock('$lib/seo', () => ({
	buildSeo: vi.fn((input: { indexable: boolean }) => ({ indexable: input.indexable }))
}));

import { loadOrgPage } from './org-page';

const run = async (visibility: string) => {
	api.org.mockResolvedValue({ data: { id: 'o1', slug: 'acme', visibility } });
	const setHeaders = vi.fn();
	const data = await loadOrgPage(
		{
			locals: { user: null, tenant: null },
			fetch: vi.fn(),
			url: new URL('https://x.example/org/acme'),
			request: new Request('https://x.example/org/acme'),
			setHeaders
		} as unknown as Parameters<typeof loadOrgPage>[0],
		'acme'
	);
	return { setHeaders, data };
};

describe('loadOrgPage indexability', () => {
	beforeEach(() => api.org.mockReset());

	it('sends noindex for an unlisted org', async () => {
		const { setHeaders, data } = await run('unlisted');
		expect(setHeaders).toHaveBeenCalledWith({ 'X-Robots-Tag': 'noindex,follow' });
		expect(data.seo).toEqual({ indexable: false });
	});

	it('does not send noindex for a public org', async () => {
		const { setHeaders, data } = await run('public');
		expect(setHeaders).not.toHaveBeenCalled();
		expect(data.seo).toEqual({ indexable: true });
	});
});
