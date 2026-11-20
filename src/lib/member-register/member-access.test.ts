import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';

vi.mock('$lib/api', () => ({}));
vi.mock('$lib/api/client', () => ({ client: {} }));

import { invalidateAfterMemberWrite } from './member-access';

describe('invalidateAfterMemberWrite', () => {
	it('also refreshes pending invitations (becoming a member ends them server-side)', async () => {
		const client = new QueryClient();
		const spy = vi.spyOn(client, 'invalidateQueries');
		await invalidateAfterMemberWrite(client, 'acme');
		const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
		expect(keys).toContain(JSON.stringify(['organization', 'acme', 'member-invitations']));
		expect(keys).toContain(JSON.stringify(['organization', 'acme', 'subscriptions']));
	});
});
