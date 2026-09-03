import * as m from '$lib/paraglide/messages.js';

/**
 * Error codes the backend appends to `/login?error=oidc_<code>` when the OIDC
 * browser flow fails (see BE PR #919). Unknown `oidc_*` codes get a generic
 * message so a new backend code degrades gracefully; non-OIDC values are not
 * ours to explain.
 */
const OIDC_ERROR_MESSAGES: Record<string, () => string> = {
	oidc_denied: m['login.oidcError_denied'],
	oidc_state: m['login.oidcError_state'],
	oidc_provider: m['login.oidcError_provider'],
	oidc_unverified_email: m['login.oidcError_unverified_email'],
	oidc_no_email: m['login.oidcError_no_email'],
	oidc_banned: m['login.oidcError_banned'],
	oidc_inactive: m['login.oidcError_inactive']
};

export function oidcErrorMessage(code: string | null): string | null {
	if (!code || !code.startsWith('oidc_')) {
		return null;
	}
	return (OIDC_ERROR_MESSAGES[code] ?? m['login.oidcError_generic'])();
}
