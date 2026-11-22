import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Layout from './+layout.svelte';

const state = vi.hoisted(() => ({
	pathname: '/account/profile',
	data: {} as Record<string, unknown>,
	user: null as { referral_code?: string } | null
}));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL(`http://localhost${state.pathname}`);
		},
		get data() {
			return state.data;
		}
	}
}));
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: {
		get user() {
			return state.user;
		}
	}
}));

function renderLayout(): ReturnType<typeof render> {
	const children = createRawSnippet(() => ({
		render: () => '<p data-testid="page-content">content</p>'
	}));
	return render(Layout, { props: { children } });
}

function hrefs(): string[] {
	return screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');
}

describe('account layout', () => {
	beforeEach(() => {
		state.pathname = '/account/profile';
		state.data = { features: {}, tenant: null };
		state.user = null;
	});

	it('wraps the page in a labelled nav and renders the page content', () => {
		renderLayout();
		expect(screen.getByRole('navigation', { name: 'Account sections' })).toBeInTheDocument();
		expect(screen.getByTestId('page-content')).toBeInTheDocument();
	});

	it('links the always-visible account pages in user-menu order', () => {
		renderLayout();
		expect(hrefs()).toEqual([
			'/account/profile',
			'/account/security',
			'/account/privacy',
			'/account/settings',
			'/account/invoices',
			'/account/memberships'
		]);
	});

	it('marks only the current page with aria-current="page"', () => {
		state.pathname = '/account/security';
		renderLayout();
		const current = screen.getAllByRole('link', { current: 'page' });
		expect(current).toHaveLength(1);
		expect(current[0]).toHaveAttribute('href', '/account/security');
	});

	it('keeps a section highlighted on its sub-pages', () => {
		state.data = { features: { oauth_provider: true }, tenant: null };
		state.pathname = '/account/developer-apps/new';
		renderLayout();
		const current = screen.getAllByRole('link', { current: 'page' });
		expect(current).toHaveLength(1);
		expect(current[0]).toHaveAttribute('href', '/account/developer-apps');
	});

	it('shows connected and developer apps only when the OAuth provider is on', () => {
		renderLayout();
		expect(hrefs()).not.toContain('/account/connected-apps');
		expect(hrefs()).not.toContain('/account/developer-apps');
	});

	it('adds both OAuth entries when the OAuth provider is on', () => {
		state.data = { features: { oauth_provider: true }, tenant: null };
		renderLayout();
		expect(hrefs()).toContain('/account/connected-apps');
		expect(hrefs()).toContain('/account/developer-apps');
	});

	it('shows referral entries to referrers and highlights payouts alone', () => {
		state.user = { referral_code: 'abc' };
		state.pathname = '/account/referral/payouts';
		renderLayout();
		expect(hrefs()).toContain('/account/referral');
		const current = screen.getAllByRole('link', { current: 'page' });
		expect(current).toHaveLength(1);
		expect(current[0]).toHaveAttribute('href', '/account/referral/payouts');
	});

	it('hides referral entries on a tenant host', () => {
		state.user = { referral_code: 'abc' };
		state.data = { features: {}, tenant: { slug: 'acme' } };
		renderLayout();
		expect(hrefs().some((h) => h.includes('/account/referral'))).toBe(false);
	});

	it('ignores a locale prefix when finding the current page', () => {
		state.pathname = '/de/account/invoices';
		renderLayout();
		expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
			'href',
			'/account/invoices'
		);
	});
});
