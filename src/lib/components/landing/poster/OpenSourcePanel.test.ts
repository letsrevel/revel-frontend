import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import OpenSourcePanel from './OpenSourcePanel.svelte';
import * as m from '$lib/paraglide/messages.js';

describe('OpenSourcePanel', () => {
	it('renders its heading at level 2', () => {
		render(OpenSourcePanel);
		// Every poster panel below the hero is an h2: the page has exactly one h1.
		expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
	});

	it('opens the GitHub CTA in a new tab without leaking the opener', () => {
		render(OpenSourcePanel);
		const cta = screen.getByRole('link', { name: m['home.poster.osCta']() });
		expect(cta).toHaveAttribute('href', 'https://github.com/letsrevel');
		expect(cta).toHaveAttribute('target', '_blank');
		// window.opener access from github.com would be a tabnabbing vector.
		expect(cta.getAttribute('rel')).toContain('noopener');
	});

	it('keeps the star emoji out of the accessible name', () => {
		render(OpenSourcePanel);
		// getByRole's `name` is an exact match on the computed accessible name, so
		// this fails the moment the decorative ⭐ loses its aria-hidden and screen
		// readers start announcing "star Star on GitHub".
		const cta = screen.getByRole('link', { name: m['home.poster.osCta']() });
		expect(cta.textContent).toContain('⭐');
	});
});
