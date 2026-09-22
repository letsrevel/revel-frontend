import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isHttpError } from '@sveltejs/kit';

vi.mock('$lib/api/client', () => ({
	questionnaireListSubmissions: vi.fn(),
	questionnaireGetSummary: vi.fn(),
	questionnaireGetOrgQuestionnaire: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({
	log: { warning: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }
}));

import {
	questionnaireListSubmissions,
	questionnaireGetSummary,
	questionnaireGetOrgQuestionnaire
} from '$lib/api/client';
import { load } from './+page.server';

const list = vi.mocked(questionnaireListSubmissions);
const summary = vi.mocked(questionnaireGetSummary);
const detail = vi.mocked(questionnaireGetOrgQuestionnaire);

function loadEvent(): Parameters<typeof load>[0] {
	return {
		params: { slug: 'org', id: 'missing-id' },
		url: new URL('https://letsrevel.io/org/org/admin/questionnaires/missing-id/submissions'),
		locals: { user: { accessToken: 'token' } },
		fetch: globalThis.fetch
	} as unknown as Parameters<typeof load>[0];
}

function failAll(status: number): void {
	const result = { data: undefined, error: { detail: 'x' }, response: { status } } as never;
	list.mockResolvedValue(result);
	summary.mockResolvedValue(result);
	detail.mockResolvedValue(result);
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

// Screenshot bug: a wrong questionnaire id rendered "500 Server Error".
describe('questionnaire submissions load — backend errors', () => {
	beforeEach(() => vi.clearAllMocks());

	it('maps a backend 404 to a SvelteKit 404', async () => {
		failAll(404);
		expect(await loadStatus()).toBe(404);
	});

	it('keeps other backend failures as 500', async () => {
		failAll(503);
		expect(await loadStatus()).toBe(500);
	});
});
