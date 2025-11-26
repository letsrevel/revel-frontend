import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	notificationpreferenceGetPreferences,
	userpreferencesGetGeneralPreferences
} from '$lib/api/generated';

export const load: PageServerLoad = async ({ cookies }) => {
	const accessToken = cookies.get('access_token');

	if (!accessToken) {
		return {
			notificationPreferences: null,
			generalPreferences: null,
			accessToken: null
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
			generalPreferences: generalData.data,
			accessToken
		};
	} catch (error) {
		console.error('Failed to fetch preferences:', error);
		return {
			notificationPreferences: null,
			generalPreferences: null,
			accessToken
		};
	}
};

// No form actions needed - NotificationPreferencesForm handles API calls via TanStack Query
