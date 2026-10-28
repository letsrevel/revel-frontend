import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SsoProviderButtons from './SsoProviderButtons.svelte';

const { pageData } = vi.hoisted(() => ({ pageData: { tenant: null as unknown } }));

vi.mock('$app/state', () => ({
	page: {
		get data() {
			return pageData;
		}
	}
}));

beforeEach(() => {
	pageData.tenant = null;
});

const providers = [
	{ key: 'google', name: 'Google' },
	{ key: 'keycloak', name: 'Keycloak (e2e)' }
];

describe('SsoProviderButtons', () => {
	it('renders one start link per provider carrying the return URL', () => {
		render(SsoProviderButtons, { props: { providers, returnUrl: '/events' } });

		const google = screen.getByRole('link', { name: 'Continue with Google' });
		expect(google.getAttribute('href')).toContain('/api/auth/oidc/google/start');
		expect(google.getAttribute('href')).toContain(`return_url=${encodeURIComponent('/events')}`);
		expect(screen.getByRole('link', { name: 'Continue with Keycloak (e2e)' })).toBeTruthy();
	});

	it('omits return_url when none is given', () => {
		render(SsoProviderButtons, { props: { providers } });
		expect(
			screen.getByRole('link', { name: 'Continue with Google' }).getAttribute('href')
		).not.toContain('return_url');
	});

	it('renders nothing when there are no providers', () => {
		render(SsoProviderButtons, { props: { providers: [] } });
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('shows official brand marks for known providers only, without changing link names', () => {
		render(SsoProviderButtons, {
			props: {
				providers: [...providers, { key: 'github', name: 'GitHub' }]
			}
		});

		// icons are decorative: accessible names stay "Continue with X"
		const google = screen.getByRole('link', { name: 'Continue with Google' });
		const github = screen.getByRole('link', { name: 'Continue with GitHub' });
		const keycloak = screen.getByRole('link', { name: 'Continue with Keycloak (e2e)' });

		expect(google.querySelector('[data-testid="sso-icon-google"]')).toBeTruthy();
		expect(github.querySelector('[data-testid="sso-icon-github"]')).toBeTruthy();
		expect(keycloak.querySelector('svg')).toBeNull();
	});

	it('renders nothing, divider included, on a tenant host', () => {
		pageData.tenant = { id: 'org-1' };
		const { container } = render(SsoProviderButtons, { props: { providers } });
		expect(screen.queryByRole('link')).toBeNull();
		expect(screen.queryByText('or')).toBeNull();
		expect(container.querySelector('.bg-border')).toBeNull();
	});
});
