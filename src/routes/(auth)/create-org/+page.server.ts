import { redirect, fail, isRedirect, type Actions } from '@sveltejs/kit';
import { organizationCreateSchema } from '$lib/schemas/organization';
import { organizationCreateOrganization } from '$lib/api/generated/sdk.gen';
import type { PageServerLoad } from './$types';

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
			const { data: orgData, error, response } = await organizationCreateOrganization({
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
					return fail(400, {
						errors: { form: errorObj.detail || 'You already own an organization' },
						...data
					});
				}

				if (errorObj.status === 403) {
					return fail(403, {
						errors: { form: errorObj.detail || 'Please verify your email before creating an organization' },
						...data
					});
				}
			}

			return fail(500, {
				errors: { form: 'Failed to create organization. Please try again.' },
				...data
			});
		} catch (err) {
			// If it's a redirect, re-throw it immediately
			if (isRedirect(err)) {
				throw err;
			}

			return fail(500, {
				errors: { form: 'An unexpected error occurred. Please try again.' },
				...data
			});
		}
	}
};
