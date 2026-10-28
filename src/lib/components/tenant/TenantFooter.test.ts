import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TenantFooter from './TenantFooter.svelte';
import { makeTenant } from './tenant-fixture';

describe('TenantFooter', () => {
	it('renders the org copyright line and the Powered by Revel line', () => {
		render(TenantFooter, {
			props: { tenant: makeTenant(), platformOrigin: 'https://letsrevel.io' }
		});
		expect(screen.getByRole('contentinfo')).toBeInTheDocument();
		expect(screen.getByText(/Acme Collective/)).toBeInTheDocument();
		expect(screen.getByText('Powered by')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Revel' })).toHaveAttribute(
			'href',
			'https://letsrevel.io'
		);
	});

	it('renders Revel as plain text when no platform origin is configured', () => {
		render(TenantFooter, { props: { tenant: makeTenant(), platformOrigin: null } });
		expect(screen.getByText('Revel')).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Revel' })).not.toBeInTheDocument();
	});

	it('links Privacy and Terms to the legal pages', () => {
		render(TenantFooter, { props: { tenant: makeTenant() } });
		expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/legal/privacy');
		expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/legal/terms');
	});
});
