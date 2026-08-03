import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import HeroPanel from './HeroPanel.svelte';
import * as m from '$lib/paraglide/messages.js';

describe('HeroPanel', () => {
	it('exposes the full static headline to assistive tech', () => {
		render(HeroPanel, { props: { isAuthenticated: false } });
		const h1 = screen.getByRole('heading', { level: 1 });
		expect(h1).toHaveAccessibleName(m['home.poster.heroAria']());
	});

	it('shows register CTA when logged out', () => {
		render(HeroPanel, { props: { isAuthenticated: false } });
		expect(
			screen.getByRole('link', { name: m['home.poster.heroStartOrganizing']() })
		).toHaveAttribute('href', '/register');
		expect(screen.getByText(m['home.alreadyHaveAccount']())).toBeInTheDocument();
	});

	it('shows dashboard CTA when logged in', () => {
		render(HeroPanel, { props: { isAuthenticated: true } });
		expect(screen.getByRole('link', { name: m['userMenu.dashboard']() })).toBeInTheDocument();
	});
});
