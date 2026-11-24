import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
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

describe('Header mobile menu focus', () => {
	beforeEach(() => {
		auth.authed = false;
	});

	it('returns focus to the menu button when the drawer closes with focus inside it', async () => {
		const user = userEvent.setup();
		render(Header);
		const toggle = screen.getByRole('button', { name: m['nav.toggleMenu']() });
		await user.click(toggle);
		const drawer = screen.getByRole('dialog');
		const inside = drawer.querySelector<HTMLElement>('button, a');
		if (!inside) throw new Error('drawer has no focusable element');
		inside.focus();
		await user.keyboard('{Escape}');
		expect(toggle).toHaveFocus();
	});
});
