import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({ pollGetPoll: vi.fn() }));
vi.mock('$lib/server/logger', () => ({
	log: { warning: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }
}));

import { pollGetPoll } from '$lib/api/generated/sdk.gen';
import { load } from './+page.server';

const getPoll = vi.mocked(pollGetPoll);
const POLL = { id: 'poll-1', organization_id: 'org-1', title: 'Pick a date' };

function loadEvent(tenant: { id: string } | null): Parameters<typeof load>[0] {
	return {
		params: { slug: 'acme', id: 'poll-1' },
		locals: { user: undefined, tenant },
		fetch
	} as unknown as Parameters<typeof load>[0];
}

describe('org poll page load', () => {
	beforeEach(() => {
		getPoll.mockReset();
		getPoll.mockResolvedValue({ data: POLL, error: undefined } as never);
	});

	it('platform host: renders any org poll', async () => {
		const result = await load(loadEvent(null));
		expect(result).toMatchObject({ poll: POLL, forbidden: false });
	});

	it('tenant host: renders a poll of the tenant org', async () => {
		const result = await load(loadEvent({ id: 'org-1' }));
		expect(result).toMatchObject({ poll: POLL });
	});

	it('tenant host: 404 for a poll that belongs to another org', async () => {
		await expect(load(loadEvent({ id: 'org-2' }))).rejects.toMatchObject({ status: 404 });
	});
});
