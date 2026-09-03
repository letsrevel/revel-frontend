import { redirect, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { authOidcExchange } from '$lib/api/client';
import { establishSession } from '$lib/server/session';
import { safeReturnUrl } from '$lib/utils/safe-redirect';
import { log } from '$lib/server/logger';

/**
 * OIDC hand-off landing. The backend 302s the browser here with a 60 s
 * single-use JWT in `?token`; we exchange it server-side for the normal
 * access/refresh pair, establish the session and redirect. Every path
 * redirects — this route must NEVER render a page, because the URL carries a
 * live (if short-lived) credential.
 *
 * TOTP is skipped for IdP logins (the IdP's MFA is trusted), so the exchange
 * always returns a full pair. IdP logins default to persistent (remember-me).
 */
export const load: PageServerLoad = async ({ url, cookies, fetch }) => {
	const token = url.searchParams.get('token');
	if (!token) {
		throw redirect(303, '/login?error=oidc_state');
	}

	try {
		const { data, response } = await authOidcExchange({ body: { token }, fetch });

		if (!response?.ok || !data) {
			log.warning('oidc_exchange_rejected', { status: response?.status });
			throw redirect(303, '/login?error=oidc_state');
		}

		await establishSession(cookies, { access: data.access, refresh: data.refresh }, true, fetch);

		throw redirect(303, safeReturnUrl(data.return_url));
	} catch (err) {
		if (isRedirect(err)) {
			throw err;
		}
		log.error('oidc_exchange_error', { error: err });
		throw redirect(303, '/login?error=oidc_state');
	}
};
