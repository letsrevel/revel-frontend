import { error, isHttpError, redirect } from '@sveltejs/kit';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import {
	organizationGetOrganization,
	permissionMyPermissions,
	organizationListResources,
	organizationGetOrganizationTokenDetails,
	organizationListMembershipPlans
} from '$lib/api';
import { log } from '$lib/server/logger';
import type { PageServerLoad } from './$types';
import type {
	OrganizationPermissionsSchema,
	OrganizationTokenSchema,
	MembershipTierSchema,
	MembershipStatus,
	PublicPlanSchema
} from '$lib/api/generated/types.gen';
import { canPerformAction } from '$lib/utils/permissions';

export const load: PageServerLoad = async ({ params, locals, fetch, url, request }) => {
	const { slug } = params;

	// Stripe hands the member back to this URL — the success/cancel URLs are built
	// server-side by the BACKEND (`subscription_stripe_service.py`, `/org/{slug}?
	// membership_success=true`), so the frontend cannot re-point them. The card
	// that explains the outcome now lives on the membership page, so forward the
	// flag there. Outside the try below: a `redirect` is not an `HttpError`, and
	// the catch would swallow it into a 500.
	const isCheckoutReturn =
		url.searchParams.has('membership_success') || url.searchParams.has('membership_cancelled');
	if (isCheckoutReturn) {
		// The whole query string travels: `?ot=` may be riding along on a private
		// org, and the membership page reads it the same way this one does.
		throw redirect(303, `/org/${encodeURIComponent(slug)}/membership${url.search}`);
	}

	try {
		// Prepare headers with authentication if user is logged in
		const headers: HeadersInit = {};
		if (locals.user?.accessToken) {
			headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
		}

		// Check for organization token (?ot=) for visibility
		const orgToken = url.searchParams.get('ot');
		if (orgToken) {
			headers['X-Org-Token'] = orgToken;
		}

		// Fetch organization details (pass auth and token to see private organizations)
		const orgResponse = await organizationGetOrganization({
			fetch,
			path: { slug },
			headers
		});

		if (!orgResponse.data) {
			if (orgResponse.response?.status === 410) {
				throw error(410, 'This invitation link is no longer valid');
			}
			throw error(404, 'Organization not found');
		}

		const organization = orgResponse.data;

		// Fetch resources and the public membership plans side by side — neither
		// depends on the other, and the plans are non-fatal: an org page still
		// renders (without the membership section) if that endpoint is down.
		const [resourcesResponse, membershipPlans] = await Promise.all([
			organizationListResources({
				fetch,
				path: { slug },
				headers
			}),
			(async (): Promise<PublicPlanSchema[]> => {
				try {
					const plansResponse = await organizationListMembershipPlans({
						fetch,
						path: { slug },
						headers
					});
					return plansResponse.data ?? [];
				} catch (err) {
					log.warning('org_plans_fetch_failed', { error: err, slug });
					return [];
				}
			})()
		]);

		const resources = resourcesResponse.data?.results || [];

		// Check if user can edit this organization and if they're already a member (requires authentication)
		let canEdit = false;
		let isMember = false;
		let membershipTier: MembershipTierSchema | null = null;
		let membershipStatus: MembershipStatus | null = null;
		let isOwner = false;
		let isStaff = false;
		if (locals.user) {
			try {
				const permissionsResponse = await permissionMyPermissions({
					fetch,
					headers
				});

				if (permissionsResponse.data) {
					const userPermissions: OrganizationPermissionsSchema = permissionsResponse.data;
					// User can edit if they have 'edit_organization' permission
					canEdit = canPerformAction(userPermissions, organization.id, 'edit_organization');

					// Check if user is a member using the memberships dict
					// memberships is now a dict of { [org_id]: MinimalOrganizationMemberSchema }
					const membership = userPermissions.memberships?.[organization.id];
					if (membership) {
						isMember = true;
						// Extract tier and status from MinimalOrganizationMemberSchema
						membershipTier = membership.tier || null;
						membershipStatus = (membership.status as MembershipStatus) || null;
					}

					// Check if user is owner or staff
					const orgPermissions = userPermissions.organization_permissions?.[organization.id];
					if (orgPermissions === 'owner') {
						isOwner = true;
					} else if (orgPermissions && typeof orgPermissions === 'object') {
						// If orgPermissions is an object with permission keys, user is staff
						isStaff = true;
					}
				}
			} catch (err) {
				// If permissions fail to load, continue without them
				// User will not be able to edit by default
				log.error('org_permissions_fetch_failed', { error: err, slug });
			}
		}

		// Fetch organization token details if token parameter is present
		let organizationTokenDetails: OrganizationTokenSchema | null = null;
		if (orgToken) {
			try {
				const tokenResponse = await organizationGetOrganizationTokenDetails({
					fetch,
					path: { token_id: orgToken },
					headers
				});

				if (tokenResponse.data) {
					organizationTokenDetails = tokenResponse.data;
				}
			} catch (err) {
				// If token is invalid or expired, continue without it
				log.error('org_token_details_fetch_failed', { error: err, slug });
			}
		}

		const lang = resolveLang(request);
		const seo = buildSeo({ kind: 'org', url, lang, org: organization });

		return {
			seo,
			organization,
			resources,
			membershipPlans,
			canEdit,
			isMember,
			membershipTier,
			membershipStatus,
			isOwner,
			isStaff,
			organizationTokenDetails, // Explicitly pass authentication state to the page
			isAuthenticated: !!locals.user
		};
	} catch (err) {
		// Re-throw SvelteKit errors (e.g. our own throw error() calls above)
		if (isHttpError(err)) throw err;

		// Handle different error types
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, 'Organization not found');
			}

			if (status === 403) {
				throw error(403, 'You do not have permission to view this organization');
			}
		}

		// Generic error
		log.error('org_load_error', { error: err, slug });
		throw error(500, 'Failed to load organization details');
	}
};
