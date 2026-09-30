import type { PageServerLoad } from './$types';
import { readUnsubscribeToken } from '$lib/utils/unsubscribe-token';

// Decoded (not verified) so expired/malformed links show the invalid-link
// state on load rather than failing at submit (#982). Server-side on purpose:
// the expiry check then uses the server clock, not a possibly skewed device
// clock, and SSR and hydration can't disagree about a token expiring between
// the two runs of a universal load.
export const load: PageServerLoad = ({ url }) => ({
	tokenInfo: readUnsubscribeToken(url.searchParams.get('token'))
});
