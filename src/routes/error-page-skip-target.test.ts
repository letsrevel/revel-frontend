import { render } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ErrorPage from './+error.svelte';

// The skip link targets #main-content; the error page must own that target
// exactly once (supplied by the site chrome, or by itself for bare embeds).
const pageStore = writable<{
	status: number;
	error: { message: string };
	url: URL;
	data: Record<string, unknown>;
}>({
	status: 404,
	error: { message: 'Not found' },
	url: new URL('http://localhost/missing'),
	data: {}
});
vi.mock('$app/stores', () => ({ page: { subscribe: (fn: never) => pageStore.subscribe(fn) } }));
vi.mock('$app/state', () => ({
	page: { data: { tenant: null }, url: new URL('http://localhost/missing') }
}));
vi.mock('$lib/components/common/Header.svelte', async () => ({
	default: (await import('$lib/components/common/__mocks__/StubPlatformHeader.svelte')).default
}));
vi.mock('$lib/components/common/Footer.svelte', async () => ({
	default: (await import('$lib/components/common/__mocks__/StubPlatformFooter.svelte')).default
}));
vi.mock('$lib/components/notifications/GlobalEmailSuppressionBanner.svelte', async () => ({
	default: (await import('$lib/components/common/__mocks__/StubBannerLink.svelte')).default
}));

function setData(data: Record<string, unknown>): void {
	pageStore.set({
		status: 404,
		error: { message: 'Not found' },
		url: new URL('http://localhost/missing'),
		data
	});
}

describe('+error.svelte', () => {
	beforeEach(() => setData({}));

	it('renders exactly one main#main-content', () => {
		const { container } = render(ErrorPage);
		expect(container.querySelectorAll('main#main-content')).toHaveLength(1);
	});

	it('renders inside the site chrome (header and footer)', () => {
		const { getByTestId } = render(ErrorPage);
		expect(getByTestId('platform-header')).toBeInTheDocument();
		expect(getByTestId('platform-footer')).toBeInTheDocument();
	});

	it('stays bare on embed documents', () => {
		setData({ embed: true });
		const { container, queryByTestId } = render(ErrorPage);
		expect(queryByTestId('platform-header')).toBeNull();
		expect(queryByTestId('platform-footer')).toBeNull();
		expect(container.querySelectorAll('main#main-content')).toHaveLength(1);
	});
});
