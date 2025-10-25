import { fail, type Actions, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { organizationadminUpdateOrganization } from '$lib/api/generated';

/**
 * Load organization data for the settings page
 * The organization is fetched by the parent layout, so we just
 * pass it through with proper typing
 */
export const load: PageServerLoad = async ({ parent }) => {
	const { organization } = await parent();

	if (!organization) {
		throw error(404, 'Organization not found');
	}

	return {
		organization
	};
};

/**
 * Form actions for updating organization settings
 */
export const actions: Actions = {
	default: async ({ request, params, cookies }) => {
		const accessToken = cookies.get('access_token');

		if (!accessToken) {
			return fail(401, {
				errors: {
					form: 'You must be logged in to update organization settings'
				}
			});
		}

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const slug = formData.get('slug') as string;
		const description = formData.get('description') as string;
		const cityIdValue = formData.get('city_id') as string;
		const visibility = (formData.get('visibility') as string) || 'public';
		const acceptNewMembers = formData.get('accept_new_members') === 'true';
		const contactEmail = formData.get('contact_email') as string;
		const oldSlug = params.slug;

		// Validate required fields
		if (!name || !name.trim()) {
			return fail(400, {
				errors: {
					name: 'Organization name is required'
				}
			});
		}

		if (!slug || !slug.trim()) {
			return fail(400, {
				errors: {
					slug: 'URL slug is required'
				}
			});
		}

		// Validate slug format (alphanumeric, hyphens, underscores)
		if (!/^[a-zA-Z0-9-_]+$/.test(slug)) {
			return fail(400, {
				errors: {
					slug: 'URL slug can only contain letters, numbers, hyphens, and underscores'
				}
			});
		}

		// Prepare update payload
		const updateData: any = {
			name: name.trim(),
			slug: slug.trim(),
			visibility,
			accept_new_members: acceptNewMembers
		};

		// Add optional fields only if they have values
		if (description) {
			updateData.description = description;
		}

		if (cityIdValue) {
			const cityId = parseInt(cityIdValue, 10);
			if (!isNaN(cityId)) {
				updateData.city_id = cityId;
			}
		}

		if (contactEmail && contactEmail.trim()) {
			updateData.contact_email = contactEmail.trim();
		}

		try {
			const { data, error: apiError } = await organizationadminUpdateOrganization({
				path: {
					slug: oldSlug
				},
				body: updateData,
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (apiError || !data) {
				// Check for specific error messages
				const errorMessage = apiError?.toString() || 'Failed to update organization settings';

				if (errorMessage.includes('slug')) {
					return fail(400, {
						errors: {
							slug: 'This URL slug is already taken'
						}
					});
				}

				return fail(500, {
					errors: {
						form: errorMessage
					}
				});
			}

			// If slug changed, we need to redirect to the new URL
			if (slug !== oldSlug) {
				return {
					success: true,
					newSlug: slug,
					organization: data
				};
			}

			return {
				success: true,
				organization: data
			};
		} catch (err) {
			console.error('Organization update error:', err);
			return fail(500, {
				errors: {
					form: 'An unexpected error occurred while updating your organization'
				}
			});
		}
	}
};
