import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import { readable } from 'svelte/store';
import TenantHeader from './TenantHeader.svelte';
import { makeTenant } from './tenant-fixture';

vi.mock('$app/stores', () => ({
	page: readable({
		url: new URL('http://events.example.org/'),
		data: { features: {}, tenant: null }
	})
}));

describe('TenantHeader', () => {
	it('shows the org name linking home, and the Events link', () => {
		render(TenantHeader, { props: { tenant: makeTenant() } });
		const nav = screen.getByRole('navigation', { name: 'Organization navigation' });
		expect(within(nav).getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/');
		expect(screen.getByRole('link', { name: 'Acme Collective' })).toHaveAttribute('href', '/');
		expect(screen.getByRole('banner')).toBeInTheDocument();
	});

	it('hides Membership and Resources when the org offers neither', () => {
		render(TenantHeader, { props: { tenant: makeTenant() } });
		expect(screen.queryByRole('link', { name: 'Membership' })).toBeNull();
		expect(screen.queryByRole('link', { name: 'Resources' })).toBeNull();
	});

	it.each([['has_membership_plans'], ['accept_membership_requests']] as const)(
		'shows Membership when %s is set',
		(flag) => {
			render(TenantHeader, { props: { tenant: makeTenant({ [flag]: true }) } });
			const nav = screen.getByRole('navigation', { name: 'Organization navigation' });
			expect(within(nav).getByRole('link', { name: 'Membership' })).toHaveAttribute(
				'href',
				'/org/acme/membership'
			);
		}
	);

	it('shows Resources when the org has resources', () => {
		render(TenantHeader, { props: { tenant: makeTenant({ has_resources: true }) } });
		const nav = screen.getByRole('navigation', { name: 'Organization navigation' });
		expect(within(nav).getByRole('link', { name: 'Resources' })).toHaveAttribute(
			'href',
			'/org/acme/resources'
		);
	});

	it('offers Login and Sign up when logged out', () => {
		render(TenantHeader, { props: { tenant: makeTenant() } });
		// The desktop actions and the mobile drawer both render these links.
		const banner = within(screen.getByRole('banner'));
		expect(banner.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
		expect(banner.getByRole('link', { name: 'Sign Up' })).toHaveAttribute('href', '/register');
	});

	it('has no Revel discovery links or wordmark', () => {
		render(TenantHeader, { props: { tenant: makeTenant() } });
		expect(screen.queryByRole('link', { name: /browse events/i })).toBeNull();
		expect(screen.queryByRole('link', { name: 'Organizations' })).toBeNull();
		expect(screen.queryByText(/let.s/i)).toBeNull();
	});

	it('wires the mobile menu button to its drawer', () => {
		render(TenantHeader, { props: { tenant: makeTenant() } });
		const button = screen.getByRole('button', { name: 'Toggle navigation menu' });
		expect(button).toHaveAttribute('aria-expanded', 'false');
		const controls = button.getAttribute('aria-controls');
		expect(controls).toBeTruthy();
		expect(document.getElementById(controls as string)).not.toBeNull();
	});
});
