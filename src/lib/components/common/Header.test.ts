import { render, screen } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import Header from './Header.svelte';

const auth = vi.hoisted(() => ({ authed: false }));

vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/'), data: { features: {}, tenant: null } })
}));
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: {
		get isAuthenticated() {
			return auth.authed;
		},
		accessToken: null,
		user: null,
		permissions: null
	}
}));
vi.mock('./MobileNav.svelte', async () => ({
	default: (await import('./__mocks__/StubPlatformFooter.svelte')).default
}));
vi.mock('./UserMenu.svelte', async () => ({
	default: (await import('./__mocks__/StubPlatformFooter.svelte')).default
}));
vi.mock('./ThemeToggle.svelte', async () => ({
	default: (await import('./__mocks__/StubPlatformFooter.svelte')).default
}));
vi.mock('./AdminButton.svelte', async () => ({
	default: (await import('./__mocks__/StubPlatformFooter.svelte')).default
}));
vi.mock('./LanguageSwitcher.svelte', async () => ({
	default: (await import('./__mocks__/StubPlatformFooter.svelte')).default
}));
vi.mock('$lib/components/notifications', async () => ({
	NotificationDropdown: (await import('./__mocks__/StubPlatformFooter.svelte')).default
}));

function mainNav(): HTMLElement {
	return screen.getByRole('navigation', { name: m['header.mainNavigation']() });
}

describe('Header main navigation', () => {
	beforeEach(() => {
		auth.authed = false;
	});

	it('uses the md breakpoint when signed out', () => {
		render(Header);
		expect(mainNav()).toHaveClass('md:flex');
		expect(mainNav()).not.toHaveClass('xl:flex');
	});

	it('uses the xl breakpoint when signed in', () => {
		auth.authed = true;
		render(Header);
		expect(mainNav()).toHaveClass('xl:flex');
		expect(mainNav()).not.toHaveClass('md:flex');
	});

	it('labels the signed-in links from the page title keys', () => {
		auth.authed = true;
		render(Header);
		for (const label of [
			m['dashboard.tickets.title'](),
			m['seriesPass.myPassesTitle'](),
			m['dashboard.rsvps.title'](),
			m['dashboard.invitations.title']()
		]) {
			expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
		}
		expect(m['dashboard.tickets.title']()).toBe('My Tickets');
		expect(m['seriesPass.myPassesTitle']()).toBe('My Passes');
		expect(m['dashboard.rsvps.title']()).toBe('My RSVPs');
		expect(m['dashboard.invitations.title']()).toBe('My Invitations');
	});
});
