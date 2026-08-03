import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ClosePanel from './ClosePanel.svelte';
import * as m from '$lib/paraglide/messages.js';

describe('ClosePanel', () => {
	it('shows Create your org when the feature flag allows it', () => {
		render(ClosePanel, { props: { canCreateOrg: true } });
		expect(
			screen.getByRole('link', { name: m['home.poster.closeCreateOrg']() })
		).toBeInTheDocument();
		// The other direction of the gate: without this, an implementation that
		// rendered BOTH branches unconditionally would still pass every test here.
		expect(screen.queryByText(m['nav.browseEvents']())).not.toBeInTheDocument();
	});

	it('falls back to Browse events when org creation is off', () => {
		render(ClosePanel, { props: { canCreateOrg: false } });
		expect(screen.queryByText(m['home.poster.closeCreateOrg']())).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: m['nav.browseEvents']() })).toBeInTheDocument();
	});

	it('points each primary CTA at its own route', () => {
		// The flag swaps the destination as well as the label; a fallback that
		// still pointed at /create-org would dead-end users who cannot create orgs.
		const { unmount } = render(ClosePanel, { props: { canCreateOrg: true } });
		expect(
			screen.getByRole('link', { name: m['home.poster.closeCreateOrg']() }).getAttribute('href')
		).toMatch(/\/create-org$/);
		unmount();

		render(ClosePanel, { props: { canCreateOrg: false } });
		expect(
			screen.getByRole('link', { name: m['nav.browseEvents']() }).getAttribute('href')
		).toMatch(/\/events$/);
	});

	it('opens the demo CTA in a new tab without leaking the opener', () => {
		render(ClosePanel, { props: { canCreateOrg: true } });
		const demo = screen.getByRole('link', { name: m['home.poster.closeTryDemo']() });
		expect(demo).toHaveAttribute('href', 'https://demo.letsrevel.io/login');
		expect(demo).toHaveAttribute('target', '_blank');
		// window.opener access from the demo origin would be a tabnabbing vector.
		expect(demo.getAttribute('rel')).toContain('noopener');
	});
});
