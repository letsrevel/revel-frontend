import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as m from '$lib/paraglide/messages.js';

const accountExportData = vi.hoisted(() => vi.fn());
const accountDeleteAccountRequest = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated', () => ({ accountExportData, accountDeleteAccountRequest }));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

import { actions } from './+page.server';

const cookies = { get: vi.fn().mockReturnValue('access-tok') };

function runExport() {
	return actions.exportData({ cookies } as unknown as Parameters<typeof actions.exportData>[0]);
}

function runDeletion() {
	return actions.requestDeletion({
		cookies,
		fetch: vi.fn()
	} as unknown as Parameters<typeof actions.requestDeletion>[0]);
}

/** The generated client RESOLVES (does not throw) on a 4xx/5xx (throwOnError: false). */
function errorResult(status: number, error: unknown) {
	return { data: undefined, error, response: new Response(null, { status }) };
}

beforeEach(() => {
	accountExportData.mockReset();
	accountDeleteAccountRequest.mockReset();
});

describe('exportData when the API returns an error result (#1226)', () => {
	it('reports a 429 as a rate-limit failure, not success', async () => {
		accountExportData.mockResolvedValue(errorResult(429, undefined));
		const result = await runExport();
		expect(result).toMatchObject({
			status: 429,
			data: { errors: { exportForm: m['serverErrors.account.exportRateLimited']() } }
		});
		expect(result).not.toHaveProperty('exportSuccess');
	});

	it('uses the backend detail for a 429 when there is one', async () => {
		accountExportData.mockResolvedValue(errorResult(429, { detail: 'Try again in 1 hour' }));
		expect(await runExport()).toMatchObject({
			status: 429,
			data: { errors: { exportForm: 'Try again in 1 hour' } }
		});
	});

	it('reports any other error result as a failure', async () => {
		accountExportData.mockResolvedValue(errorResult(403, undefined));
		expect(await runExport()).toMatchObject({
			status: 500,
			data: { errors: { exportForm: m['serverErrors.account.exportFailed']() } }
		});
	});

	it('reports success after a 2xx', async () => {
		accountExportData.mockResolvedValue({
			data: { message: 'ok' },
			error: undefined,
			response: new Response(null, { status: 200 })
		});
		expect(await runExport()).toEqual({ exportSuccess: true });
	});

	it('still reports a network throw as a failure', async () => {
		accountExportData.mockRejectedValue(new TypeError('fetch failed'));
		expect(await runExport()).toMatchObject({ status: 500 });
	});
});

describe('requestDeletion when the API returns an error result (#1226)', () => {
	it('reports a 400 (owns organizations) with the fallback message, not success', async () => {
		accountDeleteAccountRequest.mockResolvedValue(errorResult(400, undefined));
		const result = await runDeletion();
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { form: m['serverErrors.account.deleteBlockedByOrgs']() } }
		});
		expect(result).not.toHaveProperty('success');
	});

	it('reports a 403 with the active-orgs message', async () => {
		accountDeleteAccountRequest.mockResolvedValue(errorResult(403, undefined));
		expect(await runDeletion()).toMatchObject({
			status: 403,
			data: { errors: { form: m['serverErrors.account.deleteForbiddenActiveOrgs']() } }
		});
	});

	it('reports a 500 with the generic message', async () => {
		accountDeleteAccountRequest.mockResolvedValue(errorResult(500, undefined));
		expect(await runDeletion()).toMatchObject({
			status: 500,
			data: { errors: { form: m['serverErrors.account.unexpectedErrorTryLater']() } }
		});
	});

	it('reports success after a 2xx', async () => {
		accountDeleteAccountRequest.mockResolvedValue({
			data: { message: 'ok' },
			error: undefined,
			response: new Response(null, { status: 200 })
		});
		expect(await runDeletion()).toEqual({ success: true });
	});
});
