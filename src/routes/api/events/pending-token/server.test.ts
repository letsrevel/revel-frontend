import { describe, it, expect, vi } from 'vitest';
import type { RequestEvent } from './$types';
import { DELETE } from './+server';

function call(cookieValue: string | undefined, token: string | null) {
	const cookies = {
		get: vi.fn((name: string) => (name === 'pending_event_token' ? cookieValue : undefined)),
		delete: vi.fn()
	};
	const url = new URL('http://localhost/api/events/pending-token');
	if (token !== null) url.searchParams.set('token', token);
	const response = DELETE({ cookies, url } as unknown as RequestEvent);
	return { cookies, response };
}

describe('DELETE /api/events/pending-token', () => {
	it('deletes the pending event token cookie when the token matches', async () => {
		const { cookies, response } = call('et-1', 'et-1');
		expect((await response).status).toBe(204);
		expect(cookies.delete).toHaveBeenCalledWith('pending_event_token', { path: '/' });
	});

	it('keeps a cookie that holds another token', async () => {
		const { cookies, response } = call('et-other', 'et-1');
		expect((await response).status).toBe(204);
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('does nothing without a token parameter', async () => {
		const { cookies } = call('et-1', null);
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('does nothing when no cookie is set', async () => {
		const { cookies } = call(undefined, 'et-1');
		expect(cookies.delete).not.toHaveBeenCalled();
	});
});
