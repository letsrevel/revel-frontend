import { fail, type Actions, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	organizationadmincoreUpdateOrganization,
	questionnaireListOrgQuestionnaires
} from '$lib/api/generated';
import type {
	OrganizationEditSchema,
	OrganizationQuestionnaireInListSchema,
	Visibility
} from '$lib/api/generated/types.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';

/**
 * Load organization data for the settings page
 * The organization is fetched by the parent layout, so we just
 * pass it through with proper typing
 */
export const load: PageServerLoad = async ({ parent, cookies, fetch }) => {
	const { organization } = await parent();

	if (!organization) {
		throw error(404, 'Organization not found');
	}

	// Options for the default-membership-questionnaire picker. Value = the
	// OrganizationQuestionnaire id (the FK target of
	// default_membership_questionnaire), label = questionnaire name. The list
	// endpoint has no type filter — filter to MEMBERSHIP client-side.
	let membershipQuestionnaires: OrganizationQuestionnaireInListSchema[] = [];
	const accessToken = cookies.get('access_token');
	if (accessToken) {
		const res = await questionnaireListOrgQuestionnaires({
			fetch,
			query: { organization_id: organization.id, page_size: 100 },
			headers: { Authorization: `Bearer ${accessToken}` }
		});
		if (res.error) {
			// Non-fatal: the rest of the settings form is still usable, so degrade to an
			// empty picker rather than failing the page — but don't lose the cause.
			log.error('org_settings_questionnaires_list_failed', {
				slug: organization.slug,
				error: res.error
			});
		}
		membershipQuestionnaires = (res.data?.results ?? []).filter(
			(q) => q.questionnaire_type === 'membership'
		);
	}

	return {
		organization,
		membershipQuestionnaires
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

		// Subscription policy fields ride the same PUT, under the rule every guarded field
		// here follows: include a field only when its control actually posted.
		//
		// Omitting a field does NOT reset it — the backend applies just what the client
		// sent (`model_dump(exclude_unset=True)` in organization_service.update_organization,
		// and again in update_db_instance). The guard defends the other direction: the #491
		// telegram_url data loss was FE-side, a field written into `updateData`
		// unconditionally while its control wasn't rendered, clobbering the stored value.
		// Pinning payload inclusion to what the form actually submitted prevents that.
		if (formData.has('membership_grace_period_days')) {
			const graceRaw = formData.get('membership_grace_period_days') as string;
			const grace = Number.parseInt(graceRaw, 10);
			updateData.membership_grace_period_days = Number.isNaN(grace) || grace < 0 ? 0 : grace;
		}

		if (formData.has('membership_refund_policy')) {
			updateData.membership_refund_policy =
				(formData.get('membership_refund_policy') as string) ?? '';
		}

		// Revival window: same rule as the two fields above.
		if (formData.has('membership_subscription_revival_window_days')) {
			const revivalRaw = formData.get('membership_subscription_revival_window_days') as string;
			const revival = Number.parseInt(revivalRaw, 10);
			updateData.membership_subscription_revival_window_days =
				Number.isNaN(revival) || revival < 0 ? 0 : revival;
		}

		// Membership policy defaults (BE #777). The select always posts (possibly ''), so
		// has() works directly. The checkbox posts nothing when unchecked, which is
		// indistinguishable from "the control was never rendered" — so a hidden `_present`
		// sentinel carries that distinction and the guard reads it instead.
		if (formData.has('default_membership_questionnaire_id')) {
			const qid = (formData.get('default_membership_questionnaire_id') as string) || '';
			updateData.default_membership_questionnaire_id = qid || null;
		}
		if (formData.has('default_requires_membership_approval_present')) {
			updateData.default_requires_membership_approval =
				formData.get('default_requires_membership_approval') === 'true';
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
