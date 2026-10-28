import type { PageServerLoad } from './$types';
import { readUnsubscribeToken } from '$lib/utils/unsubscribe-token';
import { resolveReturnTarget } from '$lib/server/tenant-canonical';

// Decoded (not verified) so expired/malformed links show the invalid-link
// state on load rather than failing at submit (#982). Server-side on purpose:
// the expiry check then uses the server clock, not a possibly skewed device
// clock, and SSR and hydration can't disagree about a token expiring between
// the two runs of a universal load.
//
// `returnTo` (#1070): when the email was triggered from a custom domain the
// backend adds `return_host`; a validated one lets the success state link back
// to that domain's root (no token, no query).
export const load: PageServerLoad = async ({ url, fetch }) => ({
	tokenInfo: readUnsubscribeToken(url.searchParams.get('token')),
	returnTo: await resolveReturnTarget(url.searchParams.get('return_host'), fetch)
});
