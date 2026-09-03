import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import SsoProviderButtons from './SsoProviderButtons.svelte';

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
});
