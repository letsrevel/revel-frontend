import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	apiApiVersion: vi.fn()
}));

import { apiApiVersion } from '$lib/api/generated/sdk.gen';
import { getFeatures, getDemoMode, __resetFeaturesCache } from './features';
import { DEFAULT_FEATURES } from '$lib/utils/features';

const mockedApiApiVersion = vi.mocked(apiApiVersion);
const fakeFetch = vi.fn() as unknown as typeof globalThis.fetch;

beforeEach(() => {
	__resetFeaturesCache();
	mockedApiApiVersion.mockReset();
});

describe('getFeatures', () => {
	it('resolves features from the /version payload', async () => {
		mockedApiApiVersion.mockResolvedValue({
			data: {
				version: '1.0.0',
				features: {
					organization_creation: false,
					telegram: true,
					google_sso: false,
					llm_evaluation: true
				}
			},
			error: undefined
		} as never);

		const result = await getFeatures(fakeFetch);
		expect(result.organization_creation).toBe(false);
		expect(result.telegram).toBe(true);
	});

	it('returns fail-open defaults when the call throws', async () => {
		mockedApiApiVersion.mockRejectedValue(new Error('network'));
		const result = await getFeatures(fakeFetch);
		expect(result).toEqual(DEFAULT_FEATURES);
	});

	it('returns fail-open defaults when the response carries an error', async () => {
		mockedApiApiVersion.mockResolvedValue({ data: undefined, error: { status: 500 } } as never);
		const result = await getFeatures(fakeFetch);
		expect(result).toEqual(DEFAULT_FEATURES);
	});

	it('caches the result (one upstream call for two invocations)', async () => {
		mockedApiApiVersion.mockResolvedValue({
			data: { version: '1.0.0', features: DEFAULT_FEATURES },
			error: undefined
		} as never);

		await getFeatures(fakeFetch);
		await getFeatures(fakeFetch);
		expect(mockedApiApiVersion).toHaveBeenCalledTimes(1);
	});
});

describe('getDemoMode', () => {
	it('resolves demo from the /version payload', async () => {
		mockedApiApiVersion.mockResolvedValue({
			data: { version: '1.0.0', demo: true, features: DEFAULT_FEATURES },
			error: undefined
		} as never);

		expect(await getDemoMode(fakeFetch)).toBe(true);
	});

	it('defaults to false when /version omits demo', async () => {
		mockedApiApiVersion.mockResolvedValue({
			data: { version: '1.0.0', features: DEFAULT_FEATURES },
			error: undefined
		} as never);

		expect(await getDemoMode(fakeFetch)).toBe(false);
	});

	it('defaults to false when the call fails', async () => {
		mockedApiApiVersion.mockRejectedValue(new Error('network'));
		expect(await getDemoMode(fakeFetch)).toBe(false);
	});

	it('shares the cache with getFeatures (one upstream call total)', async () => {
		mockedApiApiVersion.mockResolvedValue({
			data: { version: '1.0.0', demo: true, features: DEFAULT_FEATURES },
			error: undefined
		} as never);

		await getFeatures(fakeFetch);
		expect(await getDemoMode(fakeFetch)).toBe(true);
		expect(mockedApiApiVersion).toHaveBeenCalledTimes(1);
	});
});
