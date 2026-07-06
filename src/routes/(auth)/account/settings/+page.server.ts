import type { PageServerLoad } from './$types';
import {
	notificationpreferenceGetPreferences,
	userpreferencesGetGeneralPreferences
} from '$lib/api/generated';
import { log } from '$lib/server/logger';

export const load: PageServerLoad = async ({ cookies }) => {
	const accessToken = cookies.get('access_token');

	if (!accessToken) {
		return {
			notificationPreferences: null,
			generalPreferences: null
		};
	}

	try {
		const [notificationData, generalData] = await Promise.all([
			notificationpreferenceGetPreferences({
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			}),
			userpreferencesGetGeneralPreferences({
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			})
		]);

		return {
			notificationPreferences: notificationData.data,
			generalPreferences: generalData.data
		};
	} catch (error) {
		log.error('preferences_fetch_failed', { error });
		return {
			notificationPreferences: null,
			generalPreferences: null
		};
	}
};

// No form actions needed - NotificationPreferencesForm handles API calls via TanStack Query
