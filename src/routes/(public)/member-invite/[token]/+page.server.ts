import type { Actions, PageServerLoad } from './$types';
import {
	memberregisterinvitesClaimInvite,
	memberregisterinvitesPreviewInvite
} from '$lib/api/generated/sdk.gen';
import { isClaimConflictCode, type ClaimConflictCode } from '$lib/member-register/claim-conflict';
import { log } from '$lib/server/logger';
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

export type { ClaimConflictCode };

/** Narrow an unknown 409 body to a known code; anything else is `null`. */
function conflictCode(error: unknown): ClaimConflictCode | null {
	const code = (error as { code?: unknown } | null | undefined)?.code;
	return isClaimConflictCode(code) ? code : null;
}

export type InvitePreview =
	| { status: 'ok'; organizationName: string; organizationSlug: string; fullName: string }
	| { status: 'not_found' }
	| { status: 'throttled' }
	| { status: 'error' };

export type ClaimResult =
	| {
			outcome: 'success';
			organizationSlug: string;
			/** From a preview fetched before claiming (the token is consumed afterwards). */
			organizationName: string | null;
			recordId: string;
	  }
	/**
	 * 409. The backend sends a machine `code` (`MemberRegisterInviteClaimErrorSchema`)
	 * to tell its two 409s apart; the page maps it to localized copy. `detail`
	 * (server-translated) is only the fallback for a missing or unknown code.
	 * NEVER branch on its text.
	 */
	| { outcome: 'conflict'; code: ClaimConflictCode | null; detail: string | null }
	/** 403 is a plain ErrorDetail: `detail` is secondary text only. */
	| { outcome: 'forbidden'; detail: string | null }
	| { outcome: 'not_found' | 'throttled' | 'error' | 'unauthenticated' };

export const load: PageServerLoad = async ({ params, fetch, locals }) => {
	const signedIn = !!locals.user?.accessToken;
	let preview: InvitePreview;

	try {
		// Deliberately NO Authorization header: the preview is public, and
		// the anonymous throttle must count the visitor, not their account.
		const res = await memberregisterinvitesPreviewInvite({
			path: { token: params.token },
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
	default: async ({ params, fetch, locals }): Promise<{ claim: ClaimResult }> => {
		const accessToken = locals.user?.accessToken;
		if (!accessToken) return { claim: { outcome: 'unauthenticated' } };

		// A successful claim consumes the token, so the preview 404s afterwards
		// (load re-runs after a no-JS POST). Capture the organization name now,
		// best effort, so the success view never depends on a later preview.
		let organizationName: string | null = null;
		try {
			const pre = await memberregisterinvitesPreviewInvite({
				path: { token: params.token },
				fetch
			});
			if (pre.response?.status === 200 && pre.data) organizationName = pre.data.organization_name;
		} catch {
			// Non-fatal: the success view falls back to the organization slug.
		}

		try {
			const res = await memberregisterinvitesClaimInvite({
				path: { token: params.token },
				headers: { Authorization: `Bearer ${accessToken}` },
				fetch
			});
			const status = res.response?.status;
			if (status === 200 && res.data) {
				return {
					claim: {
						outcome: 'success',
						organizationSlug: res.data.organization_slug,
						organizationName,
						recordId: String(res.data.record_id)
					}
				};
			}
			if (status === 409) {
				return {
					claim: {
						outcome: 'conflict',
						code: conflictCode(res.error),
						detail: extractApiErrorDetail(res.error)
					}
				};
			}
			if (status === 403) {
				return { claim: { outcome: 'forbidden', detail: extractApiErrorDetail(res.error) } };
			}
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
