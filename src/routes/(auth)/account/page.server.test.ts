import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

describe('/account', () => {
	it('redirects to the profile page', () => {
		let thrown: unknown;
		try {
			load({} as Parameters<typeof load>[0]);
		} catch (e) {
			thrown = e;
		}
		expect(thrown).toMatchObject({ status: 307, location: '/account/profile' });
	});
});
