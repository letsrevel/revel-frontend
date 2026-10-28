import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { loadSetupCounts } from '$lib/server/org-setup';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, fetch, params }) => {
	const { isOwner, organization } = await parent();

	// Owners only: staff go straight to the dashboard.
	if (!isOwner) {
		throw redirect(303, resolve('/(auth)/org/[slug]/admin', { slug: params.slug }));
	}

	const user = locals.user;
	if (!user?.accessToken) {
		throw error(401, 'You must be logged in');
	}

	const accessToken = user.accessToken;
	const setupCounts = await loadSetupCounts({
		orgId: organization.id,
		accessToken,
		fetch
	});

	return { setupCounts };
};
