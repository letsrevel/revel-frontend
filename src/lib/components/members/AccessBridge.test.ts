import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { OrganizationAdminDetailSchema } from '$lib/api/generated/types.gen';

vi.mock('./MembersTab.svelte', async () => {
	const { default: Probe } = await import('$lib/test-utils/MountProbe.svelte');
	return { default: Probe };
});

import AccessBridge from './AccessBridge.svelte';
import { probeMounts } from '$lib/test-utils/mount-probe';

const base = {
	organization: { slug: 'acme' } as unknown as OrganizationAdminDetailSchema,
	isOwner: true,
	permissions: null,
	tiers: [],
	staffUserIds: new Set<string>(),
	active: true,
	openCount: 1,
	search: 'ada@example.org',
	userId: 'u1'
};

describe('AccessBridge', () => {
	it('mounts a fresh member list for every opening, even for the same person', async () => {
		probeMounts.length = 0;
		const view = render(AccessBridge, { props: base });
		expect(probeMounts).toHaveLength(1);
		expect(probeMounts[0]).toMatchObject({ initialSearch: 'ada@example.org', focusUserId: 'u1' });

		// Same person again: only the opening counter changes.
		await view.rerender({ ...base, openCount: 2 });
		expect(probeMounts).toHaveLength(2);

		// A re-render with the same opening keeps the list (and its search) alive.
		await view.rerender({ ...base, openCount: 2, search: 'changed' });
		expect(probeMounts).toHaveLength(2);
	});

	it('mounts nothing while another tab is active', () => {
		probeMounts.length = 0;
		render(AccessBridge, { props: { ...base, active: false } });
		expect(probeMounts).toHaveLength(0);
	});
});
