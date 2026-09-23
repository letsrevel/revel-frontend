import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHttpError } from '@sveltejs/kit';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	questionnaireGetOrgQuestionnaire: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({
	log: { warning: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }
}));

import { questionnaireGetOrgQuestionnaire } from '$lib/api/generated/sdk.gen';
import { load } from './+page.server';

const detail = vi.mocked(questionnaireGetOrgQuestionnaire);

function loadEvent(): Parameters<typeof load>[0] {
	return {
		params: { slug: 'org', id: 'q-id' },
		locals: { user: { accessToken: 'token' } }
	} as unknown as Parameters<typeof load>[0];
}

async function loadStatus(): Promise<number> {
	try {
		await load(loadEvent());
	} catch (err) {
		if (isHttpError(err)) return err.status;
		throw err;
	}
	throw new Error('load did not throw');
}

// #951: every backend failure used to surface as "Not found".
describe('questionnaire detail load — backend errors', () => {
	beforeEach(() => vi.clearAllMocks());

	it.each([
		[404, 404],
		[403, 403],
		[503, 500]
	])('maps a backend %i to a SvelteKit %i', async (backend: number, expected: number) => {
		detail.mockResolvedValue({
			data: undefined,
			error: { detail: 'x' },
			response: { status: backend }
		} as never);
		expect(await loadStatus()).toBe(expected);
	});
});
