import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	notificationpreferenceGetPreferences: vi.fn(),
	notificationpreferenceMuteOrganization: vi.fn(),
	notificationpreferenceUnmuteOrganization: vi.fn(),
	organizationGetOrganizationById: vi.fn()
}));

import {
	notificationpreferenceMuteOrganization,
	notificationpreferenceUnmuteOrganization,
	organizationGetOrganizationById
} from '$lib/api/generated/sdk.gen';
import {
	applyMuteResult,
	organizationByIdQueryOptions,
	notificationPreferencesKey,
	setOrganizationMuted
} from './announcement-mute';
import type { NotificationPreferenceSchema } from '$lib/api/generated/types.gen';

const prefs = (muted: string[]) =>
	({ muted_organization_ids: muted }) as unknown as NotificationPreferenceSchema;

describe('setOrganizationMuted', () => {
	beforeEach(() => vi.clearAllMocks());

	it('PUTs to mute and DELETEs to unmute, with the bearer token', async () => {
		vi.mocked(notificationpreferenceMuteOrganization).mockResolvedValue({
			data: prefs(['o1'])
		} as never);
		vi.mocked(notificationpreferenceUnmuteOrganization).mockResolvedValue({
			data: prefs([])
		} as never);

		expect(await setOrganizationMuted('o1', true, 'tok')).toEqual(prefs(['o1']));
		expect(notificationpreferenceMuteOrganization).toHaveBeenCalledWith({
			path: { organization_id: 'o1' },
			headers: { Authorization: 'Bearer tok' }
		});

		expect(await setOrganizationMuted('o1', false, 'tok')).toEqual(prefs([]));
		expect(notificationpreferenceUnmuteOrganization).toHaveBeenCalledOnce();
	});

	it('throws the API error so the mutation reports it', async () => {
		vi.mocked(notificationpreferenceMuteOrganization).mockResolvedValue({
			error: { detail: 'Not found' }
		} as never);
		await expect(setOrganizationMuted('nope', true, 'tok')).rejects.toEqual({
			detail: 'Not found'
		});
	});
});

describe('applyMuteResult', () => {
	it('stores the returned preferences and refreshes org follow status', () => {
		const client = new QueryClient();
		const invalidate = vi.spyOn(client, 'invalidateQueries');
		applyMuteResult(client, prefs(['o1']));
		expect(client.getQueryData(notificationPreferencesKey)).toEqual(prefs(['o1']));
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ['follow-status', 'organization'] });
	});
});

describe('organizationByIdQueryOptions', () => {
	beforeEach(() => vi.clearAllMocks());

	it('resolves a name, and a nameless row for an organization that no longer resolves', async () => {
		vi.mocked(organizationGetOrganizationById).mockImplementation((async ({
			path
		}: {
			path: { organization_id: string };
		}) =>
			path.organization_id === 'o1'
				? { data: { id: 'o1', name: 'Acme', slug: 'acme' } }
				: { error: { detail: 'Not found' } }) as never);

		const client = new QueryClient();
		expect(await client.fetchQuery(organizationByIdQueryOptions('o1', 'tok'))).toEqual({
			id: 'o1',
			name: 'Acme',
			slug: 'acme'
		});
		expect(await client.fetchQuery(organizationByIdQueryOptions('gone', 'tok'))).toEqual({
			id: 'gone',
			name: null,
			slug: null
		});
	});

	it('keys per organization, so rows cache independently', () => {
		expect(organizationByIdQueryOptions('o1', null).queryKey).toEqual(['organization-by-id', 'o1']);
	});
});
