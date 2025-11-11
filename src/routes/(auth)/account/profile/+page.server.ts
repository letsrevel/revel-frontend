import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { accountMe, accountUpdateProfile } from '$lib/api/generated';
import { profileUpdateSchema } from '$lib/schemas/profile';

export const load: PageServerLoad = async ({ cookies }) => {
	const accessToken = cookies.get('access_token');

	if (!accessToken) {
		return {
			user: null
		};
	}

	try {
		const { data } = await accountMe({
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});

		return {
			user: data,
			accessToken
		};
	} catch (error) {
		console.error('Failed to fetch user data:', error);
		return {
			user: null,
			accessToken: null
		};
	}
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
			language: formData.get('language') as string
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

			return fail(500, {
				errors: { form: 'Failed to update profile' },
				...data
			});
		} catch (error: any) {
			console.error('Profile update error:', error);

			const apiErrors = error?.response?.data?.errors || {};
			const errors: Record<string, string> = {};

			if (apiErrors.first_name) errors.first_name = apiErrors.first_name[0];
			if (apiErrors.last_name) errors.last_name = apiErrors.last_name[0];
			if (apiErrors.preferred_name) errors.preferred_name = apiErrors.preferred_name[0];
			if (apiErrors.pronouns) errors.pronouns = apiErrors.pronouns[0];
			if (apiErrors.language) errors.language = apiErrors.language[0];

			if (Object.keys(errors).length === 0) {
				errors.form = 'An unexpected error occurred';
			}

			return fail(500, { errors, ...data });
		}
	}
};
