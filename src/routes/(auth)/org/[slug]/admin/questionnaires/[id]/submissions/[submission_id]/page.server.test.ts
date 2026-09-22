import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHttpError } from '@sveltejs/kit';

vi.mock('$lib/api/client', () => ({
	questionnaireGetSubmissionDetail: vi.fn(),
	questionnaireEvaluateSubmission: vi.fn(),
	questionnaireGetOrgQuestionnaire: vi.fn(),
	questionnaireListSubmissions: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({
	log: { warning: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }
}));

import {
	questionnaireGetSubmissionDetail,
	questionnaireGetOrgQuestionnaire,
	questionnaireListSubmissions
} from '$lib/api/client';
import { load } from './+page.server';

const submission = vi.mocked(questionnaireGetSubmissionDetail);
const detail = vi.mocked(questionnaireGetOrgQuestionnaire);
const list = vi.mocked(questionnaireListSubmissions);

function loadEvent(): Parameters<typeof load>[0] {
	return {
		params: { slug: 'org', id: 'q-id', submission_id: 's-id' },
		url: new URL('https://letsrevel.io/org/org/admin/questionnaires/q-id/submissions/s-id'),
		locals: { user: { accessToken: 'token' } },
		fetch: globalThis.fetch
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

// #951: every backend failure used to surface as "Submission not found".
describe('submission detail load — backend errors', () => {
	beforeEach(() => vi.clearAllMocks());

	it.each([
		[404, 404],
		[403, 403],
		[503, 500]
	])('maps a backend %i to a SvelteKit %i', async (backend, expected) => {
		const result = { data: undefined, error: { detail: 'x' }, response: { status: backend } };
		submission.mockResolvedValue(result as never);
		detail.mockResolvedValue(result as never);
		list.mockResolvedValue(result as never);
		expect(await loadStatus()).toBe(expected);
	});
});
