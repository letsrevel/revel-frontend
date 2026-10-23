import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

type LoadArg = Parameters<typeof load>[0];

function run(parent: { isOwner: boolean; custom_domain_enabled: boolean }) {
	const event = {
		parent: async () => ({
			isOwner: parent.isOwner,
			organization: { custom_domain_enabled: parent.custom_domain_enabled }
		})
	} as unknown as LoadArg;
	return Promise.resolve(load(event));
}

describe('custom-domain page loader gate (#1058)', () => {
	it('lets the owner in when the platform switch is on', async () => {
		await expect(run({ isOwner: true, custom_domain_enabled: true })).resolves.toEqual({});
	});

	it('404s when the platform switch is off', async () => {
		await expect(run({ isOwner: true, custom_domain_enabled: false })).rejects.toMatchObject({
			status: 404
		});
	});

	it('403s a staff member even when enabled', async () => {
		await expect(run({ isOwner: false, custom_domain_enabled: true })).rejects.toMatchObject({
			status: 403
		});
	});

	it('403s a non-owner before leaking whether the feature is enabled', async () => {
		await expect(run({ isOwner: false, custom_domain_enabled: false })).rejects.toMatchObject({
			status: 403
		});
	});
});
