import { describe, it, expect, vi, beforeEach } from 'vitest';
import { load } from './+page.server';
import { getSupportEmail } from '$lib/server/features';

vi.mock('$lib/server/features', () => ({ getSupportEmail: vi.fn() }));
const mockedGetSupportEmail = vi.mocked(getSupportEmail);

type LoadArg = Parameters<typeof load>[0];

function run(parent: { isOwner: boolean; custom_domain_enabled: boolean }) {
	const event = {
		fetch: vi.fn(),
		parent: async () => ({
			isOwner: parent.isOwner,
			organization: { custom_domain_enabled: parent.custom_domain_enabled }
		})
	} as unknown as LoadArg;
	return Promise.resolve(load(event));
}

beforeEach(() => {
	mockedGetSupportEmail.mockReset();
	mockedGetSupportEmail.mockResolvedValue('help@example.com');
});

describe('custom-domain page loader gate (#1058)', () => {
	it('lets the owner in when the platform switch is on', async () => {
		await expect(run({ isOwner: true, custom_domain_enabled: true })).resolves.toEqual({
			customDomainEnabled: true,
			supportEmail: null
		});
		expect(mockedGetSupportEmail).not.toHaveBeenCalled();
	});

	it('shows the owner the request state, with the support address, when the switch is off', async () => {
		await expect(run({ isOwner: true, custom_domain_enabled: false })).resolves.toEqual({
			customDomainEnabled: false,
			supportEmail: 'help@example.com'
		});
	});

	it('passes a missing support address through as null', async () => {
		mockedGetSupportEmail.mockResolvedValue(null);
		await expect(run({ isOwner: true, custom_domain_enabled: false })).resolves.toEqual({
			customDomainEnabled: false,
			supportEmail: null
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
