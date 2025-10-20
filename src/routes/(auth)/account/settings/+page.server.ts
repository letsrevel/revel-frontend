import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	userpreferencesGetGeneralPreferences,
	userpreferencesUpdateGlobalPreferences
} from '$lib/api/generated';
import { generalPreferencesSchema } from '$lib/schemas/preferences';

export const load: PageServerLoad = async ({ cookies }) => {
	const accessToken = cookies.get('access_token');

	if (!accessToken) {
		return {
			preferences: null
		};
	}

	try {
		const { data } = await userpreferencesGetGeneralPreferences({
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});

		return {
			preferences: data
		};
	} catch (error) {
		console.error('Failed to fetch preferences:', error);
		return {
			preferences: null
		};
	}
};

export const actions: Actions = {
	updatePreferences: async ({ request, cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, {
				errors: {
					form: 'You must be logged in to update your preferences'
				}
			});
		}

		const formData = await request.formData();
		const cityIdValue = formData.get('city_id') as string;
		const data = {
			show_me_on_attendee_list: formData.get('show_me_on_attendee_list') as string,
			event_reminders: formData.get('event_reminders') === 'true',
			silence_all_notifications: formData.get('silence_all_notifications') === 'true',
			city_id: cityIdValue && cityIdValue !== '' ? parseInt(cityIdValue) : null,
			overwrite_children: formData.get('overwrite_children') === 'true'
		};

		// Validate
		const result = generalPreferencesSchema.safeParse(data);

		if (!result.success) {
			const errors: Record<string, string> = {};
			result.error.errors.forEach((error) => {
				if (error.path[0]) {
					errors[error.path[0].toString()] = error.message;
				}
			});

			return fail(400, { errors, ...data });
		}

		try {
			const payload = {
				show_me_on_attendee_list: result.data.show_me_on_attendee_list,
				event_reminders: result.data.event_reminders,
				silence_all_notifications: result.data.silence_all_notifications,
				city_id: result.data.city_id
			};

			console.log('[Settings] Sending preferences update:', payload);

			const response = await userpreferencesUpdateGlobalPreferences({
				body: payload,
				query: {
					overwrite_children: result.data.overwrite_children
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.data) {
				return {
					success: true,
					preferences: response.data
				};
			}

			return fail(500, {
				errors: { form: 'Failed to update preferences' },
				...data
			});
		} catch (error: any) {
			console.error('Preferences update error:', error);

			const apiErrors = error?.response?.data?.errors || {};
			const errors: Record<string, string> = {};

			if (apiErrors.show_me_on_attendee_list)
				errors.show_me_on_attendee_list = apiErrors.show_me_on_attendee_list[0];
			if (apiErrors.event_reminders) errors.event_reminders = apiErrors.event_reminders[0];
			if (apiErrors.silence_all_notifications)
				errors.silence_all_notifications = apiErrors.silence_all_notifications[0];
			if (apiErrors.city_id) errors.city_id = apiErrors.city_id[0];

			if (Object.keys(errors).length === 0) {
				errors.form = 'An unexpected error occurred';
			}

			return fail(500, { errors, ...data });
		}
	}
};
