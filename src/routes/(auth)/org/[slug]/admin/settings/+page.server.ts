import { fail, type Actions, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { organizationadmincoreUpdateOrganization } from '$lib/api/generated';
import type { OrganizationEditSchema, Visibility } from '$lib/api/generated/types.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';

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
		// Narrow the untrusted visibility value against the allowed set,
		// falling back to 'public' (the previous default for missing values).
		const VISIBILITIES = ['public', 'unlisted', 'private', 'members-only', 'staff-only'] as const;
		const visibilityRaw = formData.get('visibility');
		const visibility: Visibility = VISIBILITIES.find((v) => v === visibilityRaw) ?? 'public';
		const acceptNewMembers = formData.get('accept_membership_requests') === 'true';
		const contactEmail = formData.get('contact_email') as string;
		const contactMethodRaw = formData.get('contact_method') as string | null;
		const contactMethod: 'none' | 'email' | 'form' =
			contactMethodRaw === 'email' || contactMethodRaw === 'form' ? contactMethodRaw : 'none';
		const cadenceRaw = formData.get('revenue_report_cadence') as string | null;
		const slug = params.slug;

		// Social media fields
		const instagramUrl = formData.get('instagram_url') as string;
		const facebookUrl = formData.get('facebook_url') as string;
		const blueskyUrl = formData.get('bluesky_url') as string;
		const telegramUrl = formData.get('telegram_url') as string;

		// Prepare update payload with only editable fields.
		// Note: contact_email is NOT part of OrganizationEditSchema — the backend
		// deliberately excludes it (separate verification flow) and ignores it in
		// this request; it is kept in the payload type only to preserve the
		// existing request shape.
		const updateData: OrganizationEditSchema & { contact_email?: string } = {
			visibility,
			accept_membership_requests: acceptNewMembers,
			contact_method: contactMethod
		};

		// Only owners render the revenue-report cadence control. Touch the field
		// solely when it was actually submitted, so a staff save (no field) can
		// never reset an owner's report schedule.
		if (formData.has('revenue_report_cadence')) {
			updateData.revenue_report_cadence =
				cadenceRaw === 'quarterly' || cadenceRaw === 'monthly' ? cadenceRaw : 'none';
		}

		// Subscription policy fields ride the same PUT. OrganizationEditSchema gives them
		// defaults (7 / ""), so omitting them silently resets — touch each only when it was
		// actually submitted, and round-trip it faithfully (the #491 data-loss class).
		if (formData.has('membership_grace_period_days')) {
			const graceRaw = formData.get('membership_grace_period_days') as string;
			const grace = Number.parseInt(graceRaw, 10);
			updateData.membership_grace_period_days = Number.isNaN(grace) || grace < 0 ? 0 : grace;
		}

		if (formData.has('membership_refund_policy')) {
			updateData.membership_refund_policy =
				(formData.get('membership_refund_policy') as string) ?? '';
		}

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

		// Social media fields - always include in payload to allow clearing
		updateData.instagram_url = instagramUrl?.trim() || null;
		updateData.facebook_url = facebookUrl?.trim() || null;
		updateData.bluesky_url = blueskyUrl?.trim() || null;
		if (formData.has('telegram_url')) {
			updateData.telegram_url = telegramUrl?.trim() || null;
		}

		try {
			const { data, error: apiError } = await organizationadmincoreUpdateOrganization({
				path: {
					slug
				},
				body: updateData,
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (apiError || !data) {
				// Extract user-friendly error message from API error
				const errorMessage = extractErrorMessage(
					apiError,
					'Failed to update organization settings'
				);

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
			log.error('organization_update_failed', { slug, error: err });
			const errorMessage = extractErrorMessage(
				err,
				'An unexpected error occurred while updating your organization'
			);

			return fail(500, {
				errors: {
					form: errorMessage
				}
			});
		}
	}
};
