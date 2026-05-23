import { error } from '@sveltejs/kit';
import { pollGetPoll } from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';
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

	if (res.error) {
		const status = res.response?.status ?? 500;
		console.error(`Failed to load poll: ${status}`, res.error);
		const message = extractErrorMessage(res.error, 'Failed to load poll');
		throw error(status === 404 ? 404 : status >= 500 ? 500 : 502, message);
	}

	return {
		poll: res.data!,
		isAuthenticated: !!accessToken
	};
};
