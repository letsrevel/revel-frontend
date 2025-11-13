import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	notificationpreferenceGetPreferences,
	notificationpreferenceUpdatePreferences
} from '$lib/api/generated';

export const load: PageServerLoad = async ({ cookies }) => {
	const accessToken = cookies.get('access_token');

	if (!accessToken) {
		return {
			preferences: null,
			accessToken: null
		};
	}

	try {
		const { data } = await notificationpreferenceGetPreferences({
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});

		return {
			preferences: data,
			accessToken
		};
	} catch (error) {
		console.error('Failed to fetch preferences:', error);
		return {
			preferences: null,
			accessToken
		};
	}
};

// No form actions needed - NotificationPreferencesForm handles API calls via TanStack Query
