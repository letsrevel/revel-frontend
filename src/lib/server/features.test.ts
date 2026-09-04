import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	apiApiVersion: vi.fn()
}));

import { apiApiVersion } from '$lib/api/generated/sdk.gen';
import { getFeatures, getDemoMode, getSsoProviders, __resetFeaturesCache } from './features';
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

describe('getSsoProviders', () => {
	it('returns the providers from the /version payload', async () => {
		mockedApiApiVersion.mockResolvedValue({
			data: {
				version: '1.0.0',
				features: DEFAULT_FEATURES,
				sso_providers: [{ key: 'google', name: 'Google' }]
			},
			error: undefined
		} as never);

		expect(await getSsoProviders(fakeFetch)).toEqual([{ key: 'google', name: 'Google' }]);
	});

	it('fails CLOSED to [] when the call throws', async () => {
		mockedApiApiVersion.mockRejectedValue(new Error('boom'));
		expect(await getSsoProviders(fakeFetch)).toEqual([]);
	});

	it('fails CLOSED to [] when sso_providers is absent from the payload', async () => {
		mockedApiApiVersion.mockResolvedValue({
			data: { version: '1.0.0', features: DEFAULT_FEATURES },
			error: undefined
		} as never);
		expect(await getSsoProviders(fakeFetch)).toEqual([]);
	});

	it('drops malformed provider entries but keeps valid ones', async () => {
		mockedApiApiVersion.mockResolvedValue({
			data: {
				version: '1.0.0',
				features: DEFAULT_FEATURES,
				sso_providers: [
					{ key: 'google', name: 'Google' },
					{ key: '', name: 'empty key' },
					{ name: 'no key at all' },
					{ key: 'empty-name', name: '' },
					{ key: 'no-name-at-all' },
					'not-an-object'
				]
			},
			error: undefined
		} as never);

		expect(await getSsoProviders(fakeFetch)).toEqual([{ key: 'google', name: 'Google' }]);
	});

	it('fails CLOSED to [] when sso_providers is not an array', async () => {
		mockedApiApiVersion.mockResolvedValue({
			data: { version: '1.0.0', features: DEFAULT_FEATURES, sso_providers: 'garbage' },
			error: undefined
		} as never);

		expect(await getSsoProviders(fakeFetch)).toEqual([]);
	});

	it('shares the cache with getFeatures (one upstream call total)', async () => {
		mockedApiApiVersion.mockResolvedValue({
			data: { version: '1.0.0', features: DEFAULT_FEATURES, sso_providers: [] },
			error: undefined
		} as never);
		await getFeatures(fakeFetch);
		await getSsoProviders(fakeFetch);
		expect(mockedApiApiVersion).toHaveBeenCalledTimes(1);
	});
});
