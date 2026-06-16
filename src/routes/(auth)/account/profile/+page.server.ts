import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { accountMe, accountUpdateProfile, userpreferencesGetGeneralPreferences } from '$lib/api/generated';
import { profileUpdateSchema } from '$lib/schemas/profile';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';

export const load: PageServerLoad = async ({ cookies }) => {
	const accessToken = cookies.get('access_token');

	if (!accessToken) {
		return {
			user: null,
			generalPreferences: null
		};
	}

	let user: Awaited<ReturnType<typeof accountMe>>['data'] = undefined;
	try {
		const { data } = await accountMe({
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});
		user = data;
	} catch (error) {
		log.error('profile_user_fetch_failed', { error });
		return {
			user: null,
			generalPreferences: null
		};
	}

	// Preferences are non-critical: a failure must not take down the whole profile page.
	// The component falls back to 'never' when generalPreferences is null.
	const { data: generalPreferences } = await userpreferencesGetGeneralPreferences({
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	}).catch(() => ({ data: undefined }));

	return {
		user: user ?? null,
		generalPreferences: generalPreferences ?? null
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, {
				errors: {
					form: 'You must be logged in to update your profile'
				}
			});
		}

		const formData = await request.formData();
		const data = {
			first_name: formData.get('first_name') as string,
			last_name: formData.get('last_name') as string,
			preferred_name: formData.get('preferred_name') as string,
			pronouns: formData.get('pronouns') as string,
			language: formData.get('language') as string,
			bio: (formData.get('bio') as string) || ''
		};

		// Validate
		const result = profileUpdateSchema.safeParse(data);

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
			const response = await accountUpdateProfile({
				body: result.data,
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.data) {
				return {
					success: true,
					user: response.data
				};
			}

			const errorMessage = extractErrorMessage(response.error, 'Failed to update profile');
			return fail(500, {
				errors: { form: errorMessage },
				...data
			});
		} catch (error: any) {
			log.error('profile_update_failed', { error });

			const errorMessage = extractErrorMessage(error, 'An unexpected error occurred');

			return fail(500, { errors: { form: errorMessage }, ...data });
		}
	}
};
