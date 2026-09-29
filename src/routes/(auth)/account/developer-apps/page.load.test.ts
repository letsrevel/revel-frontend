import { describe, it, expect } from 'vitest';
import { load, ssr } from './+page';

function args(oauth_provider: boolean) {
	return { parent: async () => ({ features: { oauth_provider } }) } as unknown as Parameters<
		typeof load
	>[0];
}

describe('/account/developer-apps load', () => {
	it('is client-rendered only', () => {
		expect(ssr).toBe(false);
	});
	it('404s when the provider flag is off', async () => {
		await expect(load(args(false))).rejects.toMatchObject({ status: 404 });
	});
	it('loads when the flag is on', async () => {
		await expect(load(args(true))).resolves.toBeUndefined();
	});
});
