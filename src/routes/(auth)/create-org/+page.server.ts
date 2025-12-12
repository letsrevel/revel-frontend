import { redirect, fail, isRedirect, type Actions } from '@sveltejs/kit';
import { organizationCreateSchema } from '$lib/schemas/organization';
import { organizationCreateOrganization } from '$lib/api/generated/sdk.gen';
import type { PageServerLoad } from './$types';
import { extractErrorMessage } from '$lib/utils/errors';

export const load: PageServerLoad = async ({ locals }) => {
	// Require authentication
	if (!locals.user) {
		throw redirect(303, '/login?returnUrl=/create-org');
	}

	return {
		user: locals.user
	};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		// Require authentication
		if (!locals.user) {
			throw redirect(303, '/login?returnUrl=/create-org');
		}

		const formData = await request.formData();
		const data = {
			name: formData.get('name') as string,
			contact_email: formData.get('contact_email') as string,
			city_id: formData.get('city_id') as string,
			address: formData.get('address') as string,
			description: formData.get('description') as string
		};

		// Validate
		const result = organizationCreateSchema.safeParse(data);

		if (!result.success) {
			const errors: Record<string, string> = {};
			result.error.errors.forEach((error) => {
				if (error.path[0]) {
					errors[error.path[0].toString()] = error.message;
				}
			});

			return fail(400, { errors, ...data });
		}

		// Get access token from cookie
		const accessToken = cookies.get('access_token');
		if (!accessToken) {
			return fail(401, {
				errors: { form: 'Authentication required' },
				...data
			});
		}

		try {
			// Create organization via API
			const {
				data: orgData,
				error,
				response
			} = await organizationCreateOrganization({
				headers: {
					Authorization: `Bearer ${accessToken}`
				},
				body: {
					name: result.data.name,
					contact_email: result.data.contact_email,
					city_id: result.data.city_id ? parseInt(result.data.city_id) : undefined,
					address: result.data.address || undefined,
					description: result.data.description || undefined
				}
			});

			// Check for success (201 Created or 200 OK)
			if (response?.ok && orgData) {
				// Success - redirect to organization admin settings
				throw redirect(303, `/org/${orgData.slug}/admin/settings`);
			}

			// Handle errors
			// Handle specific error cases
			if (error && typeof error === 'object') {
				const errorObj = error as { detail?: string; status?: number };

				if (errorObj.status === 400) {
					const errorMessage = extractErrorMessage(error, 'You already own an organization');
					return fail(400, {
						errors: { form: errorMessage },
						...data
					});
				}

				if (errorObj.status === 403) {
					const errorMessage = extractErrorMessage(
						error,
						'Please verify your email before creating an organization'
					);
					return fail(403, {
						errors: { form: errorMessage },
						...data
					});
				}
			}

			const errorMessage = extractErrorMessage(
				error,
				'Failed to create organization. Please try again.'
			);
			return fail(500, {
				errors: { form: errorMessage },
				...data
			});
		} catch (err) {
			// If it's a redirect, re-throw it immediately
			if (isRedirect(err)) {
				throw err;
			}

			const errorMessage = extractErrorMessage(err, 'An unexpected error occurred. Please try again.');
			return fail(500, {
				errors: { form: errorMessage },
				...data
			});
		}
	}
};
