import { error, isHttpError } from '@sveltejs/kit';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import {
	organizationGetOrganization,
	organizationListMembershipTiers,
	permissionMyPermissions
} from '$lib/api';
import { log } from '$lib/server/logger';
import type { PageServerLoad } from './$types';
import type {
	MembershipStatus,
	MembershipTierSchema,
	OrganizationPermissionsSchema,
	PublicMembershipTierSchema
} from '$lib/api/generated/types.gen';

/**
 * SSR is on (the SvelteKit default, restated because it is a decision here):
 * "become a member of X" is an indexable, linkable page, and the tier grid is
 * its entire content — rendering it only on the client would leave crawlers and
 * shared links with an empty box.
 */
export const ssr = true;

export const load: PageServerLoad = async ({ params, locals, fetch, url, request }) => {
	const { slug } = params;

	try {
		const headers: HeadersInit = {};
		if (locals.user?.accessToken) {
			headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
		}
		// Same private-org escape hatch the org landing page honours, so a token
		// link that reaches the profile also reaches its membership offer.
		const orgToken = url.searchParams.get('ot');
		if (orgToken) {
			headers['X-Org-Token'] = orgToken;
		}

		const orgResponse = await organizationGetOrganization({ fetch, path: { slug }, headers });

		if (!orgResponse.data) {
			if (orgResponse.response?.status === 410) {
				throw error(410, 'This invitation link is no longer valid');
			}
			throw error(404, 'Organization not found');
		}

		const organization = orgResponse.data;

		// Non-fatal: an org with no reachable tier listing still gets a page that
		// says so, rather than a 500 on a public URL people may have shared.
		const tiers = await (async (): Promise<PublicMembershipTierSchema[]> => {
			try {
				const response = await organizationListMembershipTiers({ fetch, path: { slug }, headers });
				return response.data ?? [];
			} catch (err) {
				log.warning('org_membership_tiers_fetch_failed', { error: err, slug });
				return [];
			}
		})();

		// The viewer's standing. It decides whether the page shows a badge instead
		// of N join CTAs, so it is worth the extra round trip — but never worth a
		// failed page: a permissions outage degrades to "logged in, no standing".
		let isMember = false;
		let membershipTier: MembershipTierSchema | null = null;
		let membershipStatus: MembershipStatus | null = null;
		let isOwner = false;
		let isStaff = false;
		if (locals.user) {
			try {
				const permissionsResponse = await permissionMyPermissions({ fetch, headers });
				if (permissionsResponse.data) {
					const userPermissions: OrganizationPermissionsSchema = permissionsResponse.data;
					const membership = userPermissions.memberships?.[organization.id];
					if (membership) {
						isMember = true;
						membershipTier = membership.tier || null;
						membershipStatus = (membership.status as MembershipStatus) || null;
					}

					const orgPermissions = userPermissions.organization_permissions?.[organization.id];
					if (orgPermissions === 'owner') {
						isOwner = true;
					} else if (orgPermissions && typeof orgPermissions === 'object') {
						isStaff = true;
					}
				}
			} catch (err) {
				log.error('org_membership_permissions_fetch_failed', { error: err, slug });
			}
		}

		const lang = resolveLang(request);
		// Canonical without the query string: `?ot=` and the Stripe return flags
		// are per-visit, and each would otherwise mint a distinct canonical URL
		// for the same page.
		const canonicalUrl = new URL(url.pathname, url.origin);
		const orgSeo = buildSeo({ kind: 'org', url: canonicalUrl, lang, org: organization });
		// The org SEO carries the right image, locale alternates and JSON-LD; only
		// the wording has to say what THIS page is. Overridden here rather than by
		// adding a `kind` to `buildSeo`, so the membership route owns its own copy.
		const title = `Membership | ${organization.name} | Revel`;
		const description = `Become a member of ${organization.name} on Revel — membership tiers, what each one includes, and how to join.`;
		const seo = {
			...orgSeo,
			title,
			description,
			og: { ...orgSeo.og, title: `Membership | ${organization.name}`, description },
			twitter: { ...orgSeo.twitter, title: `Membership | ${organization.name}`, description }
		};

		return {
			seo,
			organization,
			tiers,
			isMember,
			membershipTier,
			membershipStatus,
			isOwner,
			isStaff,
			isAuthenticated: !!locals.user
		};
	} catch (err) {
		if (isHttpError(err)) throw err;

		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;
			if (status === 404) throw error(404, 'Organization not found');
			if (status === 403) throw error(403, 'You do not have permission to view this organization');
		}

		log.error('org_membership_load_error', { error: err, slug });
		throw error(500, 'Failed to load membership options');
	}
};
