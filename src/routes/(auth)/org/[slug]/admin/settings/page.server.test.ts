import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions, load } from './+page.server';
import { organizationadmincoreUpdateOrganization } from '$lib/api/generated';
import { loadSetupCounts } from '$lib/server/org-setup';
import { loadOrgWarningCounts } from '$lib/server/org-warning-counts';
import { questionnaireListOrgQuestionnaires } from '$lib/api/generated';

vi.mock('$lib/api/generated', () => ({
	organizationadmincoreUpdateOrganization: vi.fn(),
	questionnaireListOrgQuestionnaires: vi.fn().mockResolvedValue({ data: { results: [] } })
}));
vi.mock('$app/paths', () => ({
	resolve: (p: string, params: { slug: string }) => p.replace('[slug]', params.slug)
}));
vi.mock('$lib/server/org-setup', () => ({ loadSetupCounts: vi.fn() }));
vi.mock('$lib/server/org-warning-counts', () => ({ loadOrgWarningCounts: vi.fn() }));
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

describe('settings load: warningCounts', () => {
	const warn = vi.mocked(loadOrgWarningCounts);
	const list = vi.mocked(questionnaireListOrgQuestionnaires);
	const COUNTS = { publicEventCount: 2, inSeriesCount: 1, partial: false };

	beforeEach(() => {
		warn.mockReset();
		list.mockReset();
		list.mockResolvedValue({ data: { results: [] } } as never);
	});

	it('returns the counts, loaded with the org id and the access token', async () => {
		warn.mockResolvedValue(COUNTS);
		const r = await run({ query: '' });
		expect(r).toMatchObject({ warningCounts: COUNTS });
		expect(warn).toHaveBeenCalledWith(
			expect.objectContaining({ orgId: 'org-id', accessToken: 'tok' })
		);
	});

	it('returns null when the helper fails (fail open)', async () => {
		warn.mockResolvedValue(null);
		const r = await run({ query: '' });
		expect(r).toMatchObject({ warningCounts: null });
	});

	it('starts both calls before either one resolves (parallel, not serial)', async () => {
		let release: (v: unknown) => void = vi.fn();
		list.mockReturnValue(new Promise((res) => (release = res)) as never);
		warn.mockResolvedValue(COUNTS);
		const pending = run({ query: '' });
		await vi.waitFor(() => expect(warn).toHaveBeenCalled());
		expect(list).toHaveBeenCalled();
		release({ data: { results: [] } });
		await pending;
	});

	it('skips the count call without an access token', async () => {
		const r = (await load({
			fetch: vi.fn(),
			url: new URL('http://localhost/org/acme/admin/settings'),
			cookies: { get: () => undefined },
			parent: async () => ({ isOwner: true, organization: READY_ORG })
		} as unknown as LoadArg)) as Awaited<ReturnType<typeof load>>;
		expect(warn).not.toHaveBeenCalled();
		expect(r).toMatchObject({ warningCounts: null, membershipQuestionnaires: [] });
	});
});

describe('settings action: membership_payment_instructions', () => {
	const update = vi.mocked(organizationadmincoreUpdateOrganization);

	async function submit(fields: Record<string, string | Blob>) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(fields)) fd.set(k, v);
		const arg = {
			request: { formData: async () => fd },
			params: { slug: 'acme' },
			cookies: { get: () => 'tok' }
		};
		return (actions.default as unknown as (a: typeof arg) => Promise<unknown>)(arg);
	}

	beforeEach(() => {
		update.mockReset();
		update.mockResolvedValue({ data: { slug: 'acme' }, error: undefined } as never);
	});

	const sentBody = () => update.mock.calls[0][0].body as Record<string, unknown>;

	it('omits the field when it was not submitted', async () => {
		await submit({ visibility: 'public' });
		expect(sentBody()).not.toHaveProperty('membership_payment_instructions');
	});

	it('sends the text as submitted, and an empty string to clear', async () => {
		await submit({ membership_payment_instructions: 'IBAN 123' });
		expect(sentBody().membership_payment_instructions).toBe('IBAN 123');

		update.mockClear();
		await submit({ membership_payment_instructions: '' });
		expect(sentBody().membership_payment_instructions).toBe('');
	});

	it('rejects a non-string entry with a 400 and never calls the API', async () => {
		const result = await submit({
			membership_payment_instructions: new File(['x'], 'x.txt')
		});

		expect(result).toMatchObject({ status: 400, data: { errors: { form: expect.any(String) } } });
		expect(update).not.toHaveBeenCalled();
	});
});
