import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from './+page.server';
import { loadSetupCounts } from '$lib/server/org-setup';

vi.mock('$lib/api/generated', () => ({
	organizationadmincoreUpdateOrganization: vi.fn(),
	questionnaireListOrgQuestionnaires: vi.fn().mockResolvedValue({ data: { results: [] } })
}));
vi.mock('$app/paths', () => ({
	resolve: (p: string, params: { slug: string }) => p.replace('[slug]', params.slug)
}));
vi.mock('$lib/server/org-setup', () => ({ loadSetupCounts: vi.fn() }));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

const counts = vi.mocked(loadSetupCounts);

type LoadArg = Parameters<typeof load>[0];
type Result = Awaited<ReturnType<typeof load>>;

const READY_ORG = {
	id: 'org-id',
	slug: 'acme',
	visibility: 'public',
	stripe_account_id: 'acct_1',
	stripe_charges_enabled: true
};

function run(opts: { isOwner?: boolean; query?: string; org?: object } = {}): Promise<Result> {
	const { isOwner = true, query = '?stripe_success=true', org = READY_ORG } = opts;
	return load({
		fetch: vi.fn(),
		url: new URL(`http://localhost/org/acme/admin/settings${query}`),
		cookies: { get: () => 'tok' },
		parent: async () => ({ isOwner, organization: org })
	} as unknown as LoadArg) as Promise<Result>;
}

describe('settings load: continueSetupHref', () => {
	beforeEach(() => counts.mockReset());

	it('returns the launchpad href for an owner back from Stripe with setup incomplete', async () => {
		counts.mockResolvedValue({ eventCount: 0, publishedCount: 0, latestDraft: null });
		const r = await run();
		expect(r).toMatchObject({ continueSetupHref: '/(auth)/org/acme/admin/welcome' });
	});

	it('returns null when setup is complete', async () => {
		counts.mockResolvedValue({ eventCount: 1, publishedCount: 1, latestDraft: null });
		const r = await run();
		expect(r).toMatchObject({ continueSetupHref: null });
	});

	it('does not load counts without the stripe_success param', async () => {
		const r = await run({ query: '' });
		expect(counts).not.toHaveBeenCalled();
		expect(r).toMatchObject({ continueSetupHref: null });
	});

	it('does not load counts for non-owners', async () => {
		const r = await run({ isOwner: false });
		expect(counts).not.toHaveBeenCalled();
		expect(r).toMatchObject({ continueSetupHref: null });
	});
});
