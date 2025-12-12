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
		const description = formData.get('description') as string;
		const cityIdValue = formData.get('city_id') as string;
		const address = formData.get('address') as string;
		const visibility = (formData.get('visibility') as string) || 'public';
		const acceptNewMembers = formData.get('accept_membership_requests') === 'true';
		const contactEmail = formData.get('contact_email') as string;
		const slug = params.slug;

		// Social media fields
		const instagramUrl = formData.get('instagram_url') as string;
		const facebookUrl = formData.get('facebook_url') as string;
		const blueskyUrl = formData.get('bluesky_url') as string;
		const telegramUrl = formData.get('telegram_url') as string;

		// Prepare update payload with only editable fields
		const updateData: any = {
			visibility,
			accept_membership_requests: acceptNewMembers
		};

		// Add optional fields only if they have values
		if (description !== null && description !== undefined) {
			updateData.description = description;
		}

		if (address !== null && address !== undefined) {
			updateData.address = address.trim();
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

		// Social media fields (allow empty strings to clear)
		updateData.instagram_url = instagramUrl?.trim() || null;
		updateData.facebook_url = facebookUrl?.trim() || null;
		updateData.bluesky_url = blueskyUrl?.trim() || null;
		updateData.telegram_url = telegramUrl?.trim() || null;

		try {
			const { data, error: apiError } = await organizationadminUpdateOrganization({
				path: {
					slug
				},
				body: updateData,
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (apiError || !data) {
				// Check for specific error messages
				const errorMessage = apiError?.toString() || 'Failed to update organization settings';

				return fail(500, {
					errors: {
						form: errorMessage
					}
				});
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
