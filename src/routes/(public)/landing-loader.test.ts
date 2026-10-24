import { describe, it, expect, vi, beforeEach } from 'vitest';

// A plain delegate (not vi.fn) for the org loader: spies record rejected
// promises on a derived chain that vitest then reports as unhandled.
const org = vi.hoisted(() => ({
	calls: [] as unknown[][],
	impl: async (..._args: unknown[]): Promise<unknown> => ({})
}));
vi.mock('$lib/server/org-page', () => ({
	loadOrgPage: (...args: unknown[]) => {
		org.calls.push(args);
		return org.impl(...args);
	}
}));
vi.mock('$lib/server/features', () => ({ getDemoBookingUrl: vi.fn(async () => 'https://demo') }));
vi.mock('$lib/seo/server', () => ({ resolveLang: () => 'en' }));
vi.mock('$lib/seo', () => ({ buildSeo: vi.fn(() => ({ kind: 'seo-home' })) }));

import { load } from './+page.server';

const run = (tenant: { slug: string } | null) =>
	load({
		locals: { tenant },
		url: new URL('https://x.example/'),
		request: new Request('https://x.example/'),
		fetch: vi.fn()
	} as unknown as Parameters<typeof load>[0]) as Promise<Record<string, unknown>>;

describe('landing route loader', () => {
	beforeEach(() => {
		org.calls.length = 0;
	});

	it('returns landing data on the platform host', async () => {
		const data = await run(null);
		expect(data).toMatchObject({ kind: 'landing', demoBookingUrl: 'https://demo' });
		expect(org.calls).toHaveLength(0);
	});

	it('returns the org page data for the tenant slug on a tenant host', async () => {
		org.impl = async () => ({ seo: { kind: 'seo-org' }, organization: { slug: 'acme' } });
		const data = await run({ slug: 'acme' });
		expect(org.calls).toHaveLength(1);
		expect(org.calls[0][1]).toBe('acme');
		expect(data).toMatchObject({ kind: 'org', organization: { slug: 'acme' } });
		expect(data).not.toHaveProperty('demoBookingUrl');
	});

	it('propagates org loader failures instead of falling back to the landing', async () => {
		const failure = { status: 503 };
		org.impl = async () => {
			throw failure;
		};
		const outcome = await run({ slug: 'acme' }).then(
			() => 'resolved',
			(err: unknown) => err
		);
		expect(outcome).toBe(failure);
	});
});
