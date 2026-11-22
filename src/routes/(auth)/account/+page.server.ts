import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';

/**
 * `/account` has no page of its own: the account area opens on Profile.
 * Guests never get here, the `(auth)` guard in hooks.server.ts sends them to
 * login first.
 */
export const load: PageServerLoad = () => {
	redirect(307, resolve('/(auth)/account/profile', {}));
};
