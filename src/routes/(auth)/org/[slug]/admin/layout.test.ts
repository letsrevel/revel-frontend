import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import Layout from './+layout.svelte';

const pathname = vi.hoisted(() => ({ value: '/org/acme/admin' }));

vi.mock('$app/stores', () => ({
	page: {
		subscribe: (run: (v: unknown) => void) => {
			run({ url: new URL(`http://localhost${pathname.value}`), data: {} });
			return () => undefined;
		}
	}
}));
vi.mock('$lib/utils/org-setup-progress', async (orig) => {
	const actual = await orig<typeof import('$lib/utils/org-setup-progress')>();
	return { ...actual, billingNeedsAttention: () => false };
});

const children = createRawSnippet(() => ({ render: () => '<div>content</div>' }));

function renderLayout() {
	return render(Layout, {
		props: {
			children,
			data: {
				organization: { id: 'org-1', slug: 'acme', name: 'Acme' },
				isOwner: true,
				isStaff: false,
				permissions: null,
				sidebarCollapsed: false
			} as never
		}
	});
}

/** Both the mobile and the desktop trail are in the DOM (CSS hides one). */
const currentCrumbs = () =>
	Array.from(document.querySelectorAll('ol a[aria-current="page"]')).map((a) =>
		a.textContent?.trim()
	);

describe('org admin breadcrumb', () => {
	it('marks the Admin crumb current on the admin home', () => {
		pathname.value = '/org/acme/admin';
		renderLayout();
		const crumbs = currentCrumbs();
		expect(crumbs.length).toBeGreaterThan(0);
		for (const label of crumbs) expect(label).toBe('Admin');
	});

	it('marks the section crumb current when the path is that section', () => {
		pathname.value = '/org/acme/admin/announcements';
		renderLayout();
		const crumbs = currentCrumbs();
		expect(crumbs.length).toBeGreaterThan(0);
		for (const label of crumbs) expect(label).toBe('Announcements');
	});

	it('marks no crumb current on a page nested below its section', () => {
		pathname.value = '/org/acme/admin/announcements/some-id/edit';
		renderLayout();
		expect(currentCrumbs()).toEqual([]);
		// The trail still names the section.
		expect(screen.getAllByRole('link', { name: 'Announcements' }).length).toBeGreaterThan(0);
	});
});
