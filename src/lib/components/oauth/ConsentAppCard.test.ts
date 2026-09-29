import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { AuthorizeAppSchema, AuthorizeScopeSchema } from '$lib/api/generated/types.gen';
import ConsentAppCard from './ConsentAppCard.svelte';

function app(overrides: Partial<AuthorizeAppSchema> = {}): AuthorizeAppSchema {
	return {
		name: 'Acme Planner',
		description: 'Plans things.\nSecond line.',
		logo_url: null,
		verified: false,
		registration_source: 'dcr',
		homepage_url: 'https://acme.example',
		privacy_policy_url: '',
		...overrides
	};
}
const SCOPES: AuthorizeScopeSchema[] = [
	{ name: 'openid', label: 'Sign you in', group: 'identity' }
];

describe('ConsentAppCard', () => {
	it('warns about an unverified app with a live alert', () => {
		render(ConsentAppCard, {
			props: { application: app(), scopes: SCOPES, redirectUri: 'https://acme.example/cb' }
		});
		expect(screen.getByRole('alert')).toHaveTextContent('Revel has not reviewed this app.');
		expect(
			screen.getByRole('heading', { level: 2, name: 'Revel has not reviewed this app.' })
		).toHaveAttribute('aria-level', '2');
		expect(screen.queryByTestId('status-badge')).toBeNull();
	});

	it('shows a Verified badge and no alert for a verified app', () => {
		render(ConsentAppCard, {
			props: {
				application: app({ verified: true }),
				scopes: SCOPES,
				redirectUri: 'https://acme.example/cb'
			}
		});
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.getByTestId('status-badge')).toHaveTextContent('Verified');
	});

	it('renders http(s) links only, with the host visible, and omits empty or ftp ones', () => {
		render(ConsentAppCard, {
			props: {
				application: app({ privacy_policy_url: 'ftp://files.example/p' }),
				scopes: SCOPES,
				redirectUri: 'https://acme.example/cb'
			}
		});
		const site = screen.getByRole('link', { name: /Website/ });
		expect(site).toHaveAttribute('href', 'https://acme.example');
		expect(site).toHaveAttribute('rel', 'noopener noreferrer');
		expect(site).toHaveTextContent('Website: acme.example');
		expect(screen.queryByRole('link', { name: /Privacy policy/ })).toBeNull();
	});

	it('names the redirect host and omits the line for an unparseable URI', () => {
		const { unmount } = render(ConsentAppCard, {
			props: { application: app(), scopes: SCOPES, redirectUri: 'https://acme.example:8443/cb' }
		});
		expect(screen.getByText(/you'll be sent to/)).toHaveTextContent('acme.example:8443');
		unmount();
		render(ConsentAppCard, {
			props: { application: app(), scopes: SCOPES, redirectUri: 'not a url' }
		});
		expect(screen.queryByText(/you'll be sent to/)).toBeNull();
	});

	it('says so when no scopes are requested, and never renders an empty list', () => {
		const { container } = render(ConsentAppCard, {
			props: { application: app(), scopes: [], redirectUri: 'https://acme.example/cb' }
		});
		expect(screen.getByText('This app is not asking for any permissions.')).toBeInTheDocument();
		expect(container.querySelector('ul')).toBeNull();
	});

	it('renders the description as text, preserving line breaks, never as HTML', () => {
		render(ConsentAppCard, {
			props: {
				application: app({ description: '<b>bold</b>' }),
				scopes: SCOPES,
				redirectUri: 'https://acme.example/cb'
			}
		});
		expect(screen.getByText('<b>bold</b>')).toBeInTheDocument();
	});
});
