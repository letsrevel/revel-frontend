import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from './+page.server';
import { loadSetupCounts } from '$lib/server/org-setup';

vi.mock('$lib/server/org-setup', () => ({ loadSetupCounts: vi.fn() }));

const counts = vi.mocked(loadSetupCounts);

type LoadArg = Parameters<typeof load>[0];

function run(isOwner: boolean, user: { accessToken?: string } | null = { accessToken: 'tok' }) {
	const event = {
		fetch: vi.fn(),
		params: { slug: 'acme' },
		locals: { user },
		parent: async () => ({ isOwner, organization: { id: 'org-id', slug: 'acme' } })
	} as unknown as LoadArg;
	return load(event);
}

beforeEach(() => counts.mockReset());

describe('welcome launchpad loader', () => {
	it('returns setup counts for the owner', async () => {
		const value = { eventCount: 1, publishedCount: 0 };
		counts.mockResolvedValue(value as never);
		await expect(run(true)).resolves.toEqual({ setupCounts: value });
		expect(counts).toHaveBeenCalledWith(
			expect.objectContaining({ orgId: 'org-id', accessToken: 'tok' })
		);
	});

	it('redirects non-owners to the dashboard', async () => {
		await expect(run(false)).rejects.toMatchObject({
			status: 303,
			location: '/org/acme/admin'
		});
		expect(counts).not.toHaveBeenCalled();
	});

	it('throws 401 when the access token is missing', async () => {
		await expect(run(true, null)).rejects.toMatchObject({ status: 401 });
		await expect(run(true, {})).rejects.toMatchObject({ status: 401 });
		expect(counts).not.toHaveBeenCalled();
	});
});
