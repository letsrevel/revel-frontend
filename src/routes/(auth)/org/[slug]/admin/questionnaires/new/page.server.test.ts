import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

function loadArgs(user: unknown) {
	return { locals: { user } } as unknown as Parameters<typeof load>[0];
}

describe('questionnaires/new load', () => {
	it('rejects unauthenticated requests with 401', async () => {
		await expect(load(loadArgs(undefined))).rejects.toMatchObject({ status: 401 });
	});

	it('never serializes the access token into page data', async () => {
		const result = await load(
			loadArgs({ email: 'a@b.c', accessToken: 'secret-token', refreshToken: 'r' })
		);
		expect(JSON.stringify(result)).not.toContain('secret-token');
		expect(result).not.toHaveProperty('user.accessToken');
	});
});
