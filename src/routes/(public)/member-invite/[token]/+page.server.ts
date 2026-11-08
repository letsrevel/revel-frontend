import type { Actions, PageServerLoad } from './$types';
import {
	memberregisterinvitesClaimInvite,
	memberregisterinvitesPreviewInvite
} from '$lib/api/generated/sdk.gen';
import { log } from '$lib/server/logger';
import { resolveLang } from '$lib/seo/server';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';

/**
 * Public member-register invite claim (FE #1171, BE #1319).
 *
 * SSR so the preview renders for guests without a spinner. The page is a
 * token page: it is noindex, sends no referrer, and the route param is named
 * `token` so request logging redacts it (see `redactTokens`).
 *
 * The claim is an EXPLICIT confirm (product decision): nothing in `load`, or
 * anywhere else, POSTs on page load. The POST lives in a form action so it
 * works without JavaScript and carries the visitor's real IP to the backend.
 */

export type InvitePreview =
	| { status: 'ok'; organizationName: string; organizationSlug: string; fullName: string }
	| { status: 'not_found' }
	| { status: 'throttled' }
	| { status: 'error' };

export type ClaimResult =
	| { outcome: 'success'; organizationSlug: string; recordId: string }
	/**
	 * 409. The backend has two 409s (duplicate membership, membership not
	 * started) and, unlike the 403/404, sends no machine code to tell them
	 * apart, so `detail` (translated server-side per the Accept-Language we
	 * forward) is shown verbatim. NEVER branch on its text.
	 */
	| { outcome: 'conflict'; detail: string | null }
	| { outcome: 'forbidden' | 'not_found' | 'throttled' | 'error' | 'unauthenticated' };

function acceptLanguage(request: Request): Record<string, string> {
	return { 'Accept-Language': resolveLang(request) };
}

export const load: PageServerLoad = async ({ params, fetch, locals, request }) => {
	const signedIn = !!locals.user?.accessToken;
	let preview: InvitePreview;

	try {
		// Deliberately NO Authorization header: the preview is public, and
		// the anonymous throttle must count the visitor, not their account.
		const res = await memberregisterinvitesPreviewInvite({
			path: { token: params.token },
			headers: acceptLanguage(request),
			fetch
		});
		const status = res.response?.status;
		if (status === 200 && res.data) {
			preview = {
				status: 'ok',
				organizationName: res.data.organization_name,
				organizationSlug: res.data.organization_slug,
				fullName: res.data.full_name
			};
		} else if (status === 404) {
			preview = { status: 'not_found' };
		} else if (status === 429) {
			preview = { status: 'throttled' };
		} else {
			log.warning('member_invite_preview_unexpected', { status });
			preview = { status: 'error' };
		}
	} catch (err) {
		log.warning('member_invite_preview_failed', { error: err });
		preview = { status: 'error' };
	}

	return { token: params.token, preview, signedIn };
};

export const actions = {
	default: async ({ params, fetch, locals, request }): Promise<{ claim: ClaimResult }> => {
		const accessToken = locals.user?.accessToken;
		if (!accessToken) return { claim: { outcome: 'unauthenticated' } };

		try {
			const res = await memberregisterinvitesClaimInvite({
				path: { token: params.token },
				headers: { ...acceptLanguage(request), Authorization: `Bearer ${accessToken}` },
				fetch
			});
			const status = res.response?.status;
			if (status === 200 && res.data) {
				return {
					claim: {
						outcome: 'success',
						organizationSlug: res.data.organization_slug,
						recordId: String(res.data.record_id)
					}
				};
			}
			if (status === 409) {
				return { claim: { outcome: 'conflict', detail: extractApiErrorDetail(res.error) } };
			}
			if (status === 403) return { claim: { outcome: 'forbidden' } };
			if (status === 404) return { claim: { outcome: 'not_found' } };
			if (status === 429) return { claim: { outcome: 'throttled' } };
			if (status === 401) return { claim: { outcome: 'unauthenticated' } };
			log.warning('member_invite_claim_unexpected', { status });
			return { claim: { outcome: 'error' } };
		} catch (err) {
			log.warning('member_invite_claim_failed', { error: err });
			return { claim: { outcome: 'error' } };
		}
	}
} satisfies Actions;
