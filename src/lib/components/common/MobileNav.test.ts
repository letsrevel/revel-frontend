import { render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { readable } from 'svelte/store';
import { describe, it, expect, vi, afterEach } from 'vitest';
import MobileNav from './MobileNav.svelte';

vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/'), data: { features: {}, tenant: null } })
}));
vi.mock('./UserMenu.svelte', async () => ({
	default: (await import('./__mocks__/StubPlatformFooter.svelte')).default
}));

type Listener = (e: { matches: boolean }) => void;

function mockMatchMedia(initial = false) {
	const listeners = new Set<Listener>();
	const queries: string[] = [];
	window.matchMedia = vi.fn((query: string) => {
		queries.push(query);
		return {
			matches: initial,
			media: query,
			addEventListener: (_: string, l: Listener) => listeners.add(l),
			removeEventListener: (_: string, l: Listener) => listeners.delete(l)
		};
	}) as unknown as typeof window.matchMedia;
	return {
		listeners,
		queries,
		fire: (matches: boolean) => listeners.forEach((l) => l({ matches }))
	};
}

const base = { navItems: [], isAuthenticated: false };

describe('MobileNav breakpoint behaviour', () => {
	afterEach(() => {
		document.body.style.overflow = '';
	});

	it('closes when the md query starts matching', () => {
		const mq = mockMatchMedia();
		const onClose = vi.fn();
		render(MobileNav, { props: { ...base, open: true, onClose } });
		expect(mq.queries).toEqual(['(min-width: 768px)']);
		mq.fire(false);
		expect(onClose).not.toHaveBeenCalled();
		mq.fire(true);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('uses the xl query for a wide nav', () => {
		const mq = mockMatchMedia();
		render(MobileNav, { props: { ...base, open: true, onClose: vi.fn(), wideNav: true } });
		expect(mq.queries).toEqual(['(min-width: 1280px)']);
	});

	it('closes immediately when already past the breakpoint', () => {
		const mq = mockMatchMedia(true);
		const onClose = vi.fn();
		render(MobileNav, { props: { ...base, open: true, onClose } });
		expect(onClose).toHaveBeenCalled();
		expect(mq.listeners.size).toBe(0);
	});

	it('removes its listener when re-rendered closed', async () => {
		const mq = mockMatchMedia();
		const { rerender } = render(MobileNav, { props: { ...base, open: true, onClose: vi.fn() } });
		expect(mq.listeners.size).toBe(1);
		await rerender({ ...base, open: false, onClose: vi.fn() });
		expect(mq.listeners.size).toBe(0);
	});

	it('keeps the closed drawer inert and out of the accessibility tree', () => {
		mockMatchMedia();
		render(MobileNav, { props: { ...base, open: false, onClose: vi.fn() } });
		const drawer = screen.getByRole('dialog', { hidden: true });
		expect((drawer as HTMLElement & { inert?: boolean }).inert).toBe(true);
		expect(drawer).toHaveAttribute('aria-hidden', 'true');
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('makes the drawer interactive when open', () => {
		mockMatchMedia();
		render(MobileNav, { props: { ...base, open: true, onClose: vi.fn() } });
		const drawer = screen.getByRole('dialog');
		expect((drawer as HTMLElement & { inert?: boolean }).inert).toBeFalsy();
		expect(drawer).not.toHaveAttribute('aria-hidden');
	});

	it('hides the backdrop with the same breakpoint class as the drawer', () => {
		mockMatchMedia();
		const { container } = render(MobileNav, { props: { ...base, open: true, onClose: vi.fn() } });
		const backdrop = container.querySelector('[role="presentation"]');
		expect(backdrop).toHaveClass('md:hidden');
		expect(screen.getByRole('dialog')).toHaveClass('md:hidden');
	});

	it('uses xl:hidden on the backdrop for a wide nav', () => {
		mockMatchMedia();
		const { container } = render(MobileNav, {
			props: { ...base, open: true, onClose: vi.fn(), wideNav: true }
		});
		expect(container.querySelector('[role="presentation"]')).toHaveClass('xl:hidden');
	});
});

describe('MobileNav focus management', () => {
	const items = { navItems: [{ href: '/events', label: 'Events' }], isAuthenticated: false };

	function opener(): HTMLButtonElement {
		const button = document.createElement('button');
		button.textContent = 'Open menu';
		document.body.appendChild(button);
		button.focus();
		return button;
	}

	afterEach(() => {
		document.body.style.overflow = '';
		document.body.innerHTML = '';
	});

	/** Dispatches a Tab keydown; returns false when a listener prevented the default. */
	function tabFrom(el: Element, shiftKey = false): boolean {
		return el.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
		);
	}

	it('moves focus to the close button when it opens', async () => {
		mockMatchMedia();
		opener();
		const { rerender } = render(MobileNav, {
			props: { ...items, open: false, onClose: vi.fn() }
		});
		await rerender({ ...items, open: true, onClose: vi.fn() });
		await tick();
		expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
	});

	it('wraps Tab from the last item to the close button', async () => {
		mockMatchMedia();
		render(MobileNav, { props: { ...items, open: true, onClose: vi.fn() } });
		await tick();
		const links = within(screen.getByRole('dialog')).getAllByRole('link');
		const last = links[links.length - 1];
		last.focus();
		expect(tabFrom(last)).toBe(false);
		expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
	});

	it('wraps Shift+Tab from the close button to the last item', async () => {
		mockMatchMedia();
		render(MobileNav, { props: { ...items, open: true, onClose: vi.fn() } });
		await tick();
		const close = screen.getByRole('button', { name: 'Close menu' });
		close.focus();
		expect(tabFrom(close, true)).toBe(false);
		const links = within(screen.getByRole('dialog')).getAllByRole('link');
		expect(links[links.length - 1]).toHaveFocus();
	});

	it('pulls focus back into the drawer when Tab starts outside it', async () => {
		mockMatchMedia();
		render(MobileNav, { props: { ...items, open: true, onClose: vi.fn() } });
		await tick();
		const outside = opener();
		expect(tabFrom(outside)).toBe(false);
		expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
	});

	it('leaves Tab alone while the drawer is closed', () => {
		mockMatchMedia();
		const outside = opener();
		render(MobileNav, { props: { ...items, open: false, onClose: vi.fn() } });
		expect(tabFrom(outside)).toBe(true);
		expect(outside).toHaveFocus();
	});

	it('closes on Escape and returns focus to the opener', async () => {
		mockMatchMedia();
		const button = opener();
		const onClose = vi.fn();
		const { rerender } = render(MobileNav, { props: { ...items, open: false, onClose } });
		await rerender({ ...items, open: true, onClose });
		await tick();
		const close = screen.getByRole('button', { name: 'Close menu' });
		expect(close).toHaveFocus();
		close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(onClose).toHaveBeenCalledTimes(1);
		await rerender({ ...items, open: false, onClose });
		expect(button).toHaveFocus();
	});
});
