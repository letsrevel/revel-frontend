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

	it('points the log-in prompt at the login route', () => {
		render(HeroPanel, { props: { isAuthenticated: false } });
		// A real link, not styled text: the prompt is the only way a returning
		// user reaches login from the hero.
		const login = screen.getByRole('link', { name: m['home.alreadyHaveAccount']() });
		expect(login.getAttribute('href')).toMatch(/\/login$/);
	});

	it('opens the demo CTA in a new tab without leaking the opener', () => {
		render(HeroPanel, { props: { isAuthenticated: false } });
		const demo = screen.getByRole('link', { name: m['home.poster.heroPeekDemo']() });
		expect(demo).toHaveAttribute('href', 'https://demo.letsrevel.io/login');
		expect(demo).toHaveAttribute('target', '_blank');
		// window.opener access from the demo origin would be a tabnabbing vector.
		expect(demo.getAttribute('rel')).toContain('noopener');
	});

	it('shows dashboard CTA when logged in', () => {
		render(HeroPanel, { props: { isAuthenticated: true } });
		expect(screen.getByRole('link', { name: m['userMenu.dashboard']() })).toBeInTheDocument();
		// The auth switch must be exclusive — a logged-in user seeing "start
		// organizing" would mean both branches rendered.
		expect(screen.queryByRole('link', { name: m['home.poster.heroStartOrganizing']() })).toBeNull();
	});
});
