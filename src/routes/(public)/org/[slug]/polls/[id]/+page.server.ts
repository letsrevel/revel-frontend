import { error } from '@sveltejs/kit';
import { pollGetPoll } from '$lib/api/generated/sdk.gen';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const accessToken = locals.user?.accessToken;

	const headers: Record<string, string> = {};
	if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

	const res = await pollGetPoll({
		fetch,
		path: { poll_id: params.id },
		headers
	});

	if (res.error) throw error(404, 'Poll not found');

	return {
		poll: res.data!,
		isAuthenticated: !!accessToken,
		accessToken: accessToken ?? null
	};
};
