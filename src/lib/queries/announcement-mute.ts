import { queryOptions, type QueryClient } from '@tanstack/svelte-query';
import {
	notificationpreferenceGetPreferences,
	notificationpreferenceMuteOrganization,
	notificationpreferenceUnmuteOrganization,
	organizationGetOrganizationById
} from '$lib/api/generated/sdk.gen';
import type { NotificationPreferenceSchema } from '$lib/api/generated/types.gen';

/**
 * Per-organization announcement mute (#984, backend #1031/#1033).
 *
 * The mute lives on the viewer's notification preferences
 * (`muted_organization_ids`) and stops an organization's announcements on every
 * channel. It never touches tickets, receipts or event cancellations. The
 * follow toggle `notify_announcements` is a VIEW of the same mute (true = not
 * muted), so every write here refreshes the follow status too, and the follow
 * button's writes refresh these preferences.
 */

/** Same key NotificationPreferencesForm invalidates after a save. */
export const notificationPreferencesKey = ['notification-preferences'] as const;

export function notificationPreferencesQueryOptions(accessToken: string | null) {
	return queryOptions({
		queryKey: notificationPreferencesKey,
		queryFn: async (): Promise<NotificationPreferenceSchema> => {
			const res = await notificationpreferenceGetPreferences({
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw res.error;
			return res.data;
		},
		enabled: !!accessToken
	});
}

/** Mute (`muted = true`) or unmute an organization. Idempotent on the backend. */
export async function setOrganizationMuted(
	organizationId: string,
	muted: boolean,
	accessToken: string | null
): Promise<NotificationPreferenceSchema> {
	const options = {
		path: { organization_id: organizationId },
		headers: { Authorization: `Bearer ${accessToken}` }
	};
	const res = muted
		? await notificationpreferenceMuteOrganization(options)
		: await notificationpreferenceUnmuteOrganization(options);
	if (res.error) throw res.error;
	return res.data;
}

/** After a mute write: store the returned preferences and refresh follow views. */
export function applyMuteResult(queryClient: QueryClient, prefs: NotificationPreferenceSchema) {
	queryClient.setQueryData(notificationPreferencesKey, prefs);
	queryClient.invalidateQueries({ queryKey: ['follow-status', 'organization'] });
}

export interface MutedOrganization {
	id: string;
	/** Null when the organization can't be resolved (deleted, or no longer visible). */
	name: string | null;
	slug: string | null;
}

/**
 * Names for the muted IDs. The preferences only carry IDs, so each one is
 * resolved through the public by-ID endpoint; the list stays usable (unmute
 * still works) for any organization that no longer resolves.
 */
export function mutedOrganizationsQueryOptions(ids: readonly string[], accessToken: string | null) {
	return queryOptions({
		queryKey: ['muted-organizations', [...ids].sort()],
		queryFn: (): Promise<MutedOrganization[]> =>
			Promise.all(
				ids.map(async (id): Promise<MutedOrganization> => {
					try {
						const res = await organizationGetOrganizationById({
							path: { organization_id: id },
							headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
						});
						if (res.error || !res.data) return { id, name: null, slug: null };
						return { id, name: res.data.name, slug: res.data.slug };
					} catch {
						return { id, name: null, slug: null };
					}
				})
			),
		enabled: ids.length > 0,
		staleTime: 5 * 60 * 1000
	});
}
