import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { accountExportData as AccountExportData } from '$lib/api/generated';

/** The SDK result contract; `error` is widened because a network failure carries a TypeError. */
type SdkResult = Awaited<ReturnType<typeof AccountExportData>>;
type MockResult = {
	data: SdkResult['data'];
	error: unknown;
	response: SdkResult['response'] | undefined;
};

const accountExportData = vi.hoisted(() => vi.fn());
const accountDeleteAccountRequest = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated', () => ({ accountExportData, accountDeleteAccountRequest }));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

import { actions } from './+page.server';

const cookies = { get: vi.fn().mockReturnValue('access-tok') };
const eventFetch = vi.fn();

function runExport(): ReturnType<typeof actions.exportData> {
	return actions.exportData({ cookies, fetch: eventFetch } as unknown as Parameters<
		typeof actions.exportData
	>[0]);
}

function runDeletion(): ReturnType<typeof actions.requestDeletion> {
	return actions.requestDeletion({ cookies, fetch: eventFetch } as unknown as Parameters<
		typeof actions.requestDeletion
	>[0]);
}

/** The generated client RESOLVES (does not throw) on a 4xx/5xx (throwOnError: false). */
function errorResult(status: number, error: unknown): MockResult {
	return { data: undefined, error, response: new Response(null, { status }) } satisfies MockResult;
}

/** A network failure as the real client reports it: resolved, with no response. */
const networkResult = (): MockResult =>
	({
		data: undefined,
		error: new TypeError('fetch failed'),
		response: undefined
	}) satisfies MockResult;

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

	it('shows the localized message, not the transport error, on a network failure', async () => {
		accountExportData.mockResolvedValue(networkResult());
		const result = await runExport();
		expect(result).toMatchObject({
			status: 500,
			data: { errors: { exportForm: m['serverErrors.account.exportFailed']() } }
		});
		expect(JSON.stringify(result)).not.toContain('fetch failed');
	});

	it('reports success after a 2xx', async () => {
		accountExportData.mockResolvedValue({
			data: { message: 'ok' },
			error: undefined,
			response: new Response(null, { status: 200 })
		});
		expect(await runExport()).toEqual({ exportSuccess: true });
	});

	it('passes the event fetch to the SDK call', async () => {
		accountExportData.mockResolvedValue(errorResult(500, undefined));
		await runExport();
		expect(accountExportData.mock.calls[0][0].fetch).toBe(eventFetch);
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

	it('shows the localized message, not the transport error, on a network failure', async () => {
		accountDeleteAccountRequest.mockResolvedValue(networkResult());
		const result = await runDeletion();
		expect(result).toMatchObject({
			status: 500,
			data: { errors: { form: m['serverErrors.account.unexpectedErrorTryLater']() } }
		});
		expect(JSON.stringify(result)).not.toContain('fetch failed');
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
