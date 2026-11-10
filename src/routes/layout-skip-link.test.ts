import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, it, expect, vi } from 'vitest';
import Layout from './+layout.svelte';
import type { LayoutData } from './$types';

vi.mock('$app/navigation', () => ({ afterNavigate: vi.fn() }));
vi.mock('$app/state', () => ({ page: { data: {} } }));
vi.mock('mode-watcher', async () => ({
	ModeWatcher: (await import('$lib/components/common/__mocks__/StubPlatformFooter.svelte')).default
}));
vi.mock('$lib/components/brand/OrgBrandStyle.svelte', async () => ({
	default: (await import('$lib/components/common/__mocks__/StubPlatformFooter.svelte')).default
}));
// Each banner renders a focusable link so tab order is observable.
vi.mock('$lib/components/common/DemoBanner.svelte', async () => ({
	default: (await import('$lib/components/common/__mocks__/StubBannerLink.svelte')).default
}));
vi.mock('$lib/components/common/ImpersonationBanner.svelte', async () => ({
	default: (await import('$lib/components/common/__mocks__/StubBannerLink.svelte')).default
}));
vi.mock('$lib/components/common/MaintenanceBanner.svelte', async () => ({
	default: (await import('$lib/components/common/__mocks__/StubBannerLink.svelte')).default
}));

const auth = {
	hasAccessToken: false,
	hasRefreshToken: false,
	fingerprint: null,
	impersonated: false
};

function renderLayout(embed: boolean) {
	const children = createRawSnippet(() => ({
		render: () => '<main id="main-content"><a href="/x">page link</a></main>'
	}));
	// Partial LayoutData: the layout only reads `embed` and `auth` on this path.
	const data = { embed, auth } as unknown as LayoutData;
	return render(Layout, { props: { data, children } });
}

describe('root layout skip link', () => {
	it('is the first focusable element, before every banner', () => {
		const { container } = renderLayout(false);
		const focusables = Array.from(container.querySelectorAll<HTMLElement>('a[href], button'));
		expect(focusables[0]).toHaveAttribute('href', '#main-content');
		expect(focusables[0]).toHaveTextContent(/skip to main content/i);
		expect(screen.getAllByTestId('banner-link')).toHaveLength(3);
		for (const banner of screen.getAllByTestId('banner-link')) {
			expect(
				focusables[0].compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING
			).toBeTruthy();
		}
		expect(container.querySelector('#main-content')).not.toBeNull();
	});

	it('is absent in embed mode', () => {
		renderLayout(true);
		expect(screen.queryByRole('link', { name: /skip to main content/i })).toBeNull();
		expect(screen.queryAllByTestId('banner-link')).toHaveLength(0);
	});
});
