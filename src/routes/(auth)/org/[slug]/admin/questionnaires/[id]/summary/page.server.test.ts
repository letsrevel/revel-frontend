import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHttpError } from '@sveltejs/kit';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	questionnaireGetOrgQuestionnaire: vi.fn(),
	questionnaireGetSummary: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({
	log: { warning: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }
}));

import {
	questionnaireGetOrgQuestionnaire,
	questionnaireGetSummary
} from '$lib/api/generated/sdk.gen';
import { load } from './+page.server';

const detail = vi.mocked(questionnaireGetOrgQuestionnaire);
const summary = vi.mocked(questionnaireGetSummary);

function loadEvent(): Parameters<typeof load>[0] {
	return {
		params: { slug: 'org', id: 'q-id' },
		url: new URL('https://letsrevel.io/org/org/admin/questionnaires/q-id/summary'),
		locals: { user: { accessToken: 'token' } }
	} as unknown as Parameters<typeof load>[0];
}

function failed(status: number): never {
	return { data: undefined, error: { detail: 'x' }, response: { status } } as never;
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

// #951: every questionnaire failure used to surface as "Not found".
describe('questionnaire summary load — backend errors', () => {
	beforeEach(() => vi.clearAllMocks());

	it.each([
		[404, 404],
		[403, 403],
		[503, 500]
	])('maps a backend %i to a SvelteKit %i', async (backend: number, expected: number) => {
		detail.mockResolvedValue(failed(backend));
		summary.mockResolvedValue(failed(backend));
		expect(await loadStatus()).toBe(expected);
	});

	it('keeps the summary failure status when only the summary call fails', async () => {
		detail.mockResolvedValue({ data: { id: 'q-id' }, error: undefined } as never);
		summary.mockResolvedValue(failed(403));
		expect(await loadStatus()).toBe(403);
	});
});
