import { cleanup, render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
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

	function addButton(label: string, attrs: Record<string, string> = {}): HTMLButtonElement {
		const button = document.createElement('button');
		button.textContent = label;
		for (const [k, v] of Object.entries(attrs)) button.setAttribute(k, v);
		document.body.appendChild(button);
		return button;
	}

	function opener(): HTMLButtonElement {
		const button = addButton('Open menu');
		button.focus();
		return button;
	}

	function lastLink(): HTMLElement {
		const links = within(screen.getByRole('dialog')).getAllByRole('link');
		return links[links.length - 1];
	}

	afterEach(() => {
		// Unmount first, so the drawer's cleanup runs against a connected DOM.
		cleanup();
		document.body.style.overflow = '';
		document.body.innerHTML = '';
	});

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
		const user = userEvent.setup();
		render(MobileNav, { props: { ...items, open: true, onClose: vi.fn() } });
		await tick();
		lastLink().focus();
		await user.tab();
		expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
	});

	it('wraps Shift+Tab from the close button to the last item', async () => {
		mockMatchMedia();
		const user = userEvent.setup();
		render(MobileNav, { props: { ...items, open: true, onClose: vi.fn() } });
		await tick();
		screen.getByRole('button', { name: 'Close menu' }).focus();
		await user.tab({ shift: true });
		expect(lastLink()).toHaveFocus();
	});

	it('pulls focus back into the drawer when Tab starts outside it', async () => {
		mockMatchMedia();
		const user = userEvent.setup();
		render(MobileNav, { props: { ...items, open: true, onClose: vi.fn() } });
		await tick();
		opener();
		await user.tab();
		expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
	});

	it('leaves Tab alone while the drawer is closed', async () => {
		mockMatchMedia();
		const user = userEvent.setup();
		const outside = opener();
		const next = addButton('Next');
		render(MobileNav, { props: { ...items, open: false, onClose: vi.fn() } });
		await user.tab();
		expect(next).toHaveFocus();
		expect(outside).not.toHaveFocus();
	});

	it('closes on Escape and returns focus to the opener', async () => {
		mockMatchMedia();
		const user = userEvent.setup();
		const button = opener();
		const onClose = vi.fn();
		const { rerender } = render(MobileNav, { props: { ...items, open: false, onClose } });
		await rerender({ ...items, open: true, onClose });
		await tick();
		expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
		await user.keyboard('{Escape}');
		expect(onClose).toHaveBeenCalledTimes(1);
		await rerender({ ...items, open: false, onClose });
		expect(button).toHaveFocus();
	});

	it('returns focus to the aria-controls toggle even when it never took focus (Safari)', async () => {
		mockMatchMedia();
		const toggle = addButton('Toggle', { 'aria-controls': 'drawer' });
		// Safari leaves focus on whatever had it before the tap on the toggle.
		opener();
		const { rerender } = render(MobileNav, {
			props: { ...items, id: 'drawer', open: false, onClose: vi.fn() }
		});
		await rerender({ ...items, id: 'drawer', open: true, onClose: vi.fn() });
		await tick();
		await rerender({ ...items, id: 'drawer', open: false, onClose: vi.fn() });
		expect(toggle).toHaveFocus();
	});

	it('keeps focus where the caller moved it on close', async () => {
		mockMatchMedia();
		opener();
		const elsewhere = addButton('Elsewhere');
		const { rerender } = render(MobileNav, {
			props: { ...items, open: false, onClose: vi.fn() }
		});
		await rerender({ ...items, open: true, onClose: vi.fn() });
		await tick();
		elsewhere.focus();
		await rerender({ ...items, open: false, onClose: vi.fn() });
		expect(elsewhere).toHaveFocus();
	});

	it('still traps Tab when a widget outside the drawer already handled it', async () => {
		mockMatchMedia();
		render(MobileNav, { props: { ...items, open: true, onClose: vi.fn() } });
		await tick();
		const outside = opener();
		outside.addEventListener('keydown', (e) => e.preventDefault());
		outside.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
		);
		expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
	});

	it('does not close on an Escape that a nested widget already handled', async () => {
		mockMatchMedia();
		const onClose = vi.fn();
		render(MobileNav, { props: { ...items, open: true, onClose } });
		await tick();
		const close = screen.getByRole('button', { name: 'Close menu' });
		close.addEventListener('keydown', (e) => e.preventDefault());
		close.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		);
		expect(onClose).not.toHaveBeenCalled();
	});

	it('leaves Tab to a modal that is open above the drawer', async () => {
		mockMatchMedia();
		render(MobileNav, { props: { ...items, open: true, onClose: vi.fn() } });
		await tick();
		const modal = document.createElement('div');
		modal.setAttribute('role', 'dialog');
		modal.setAttribute('aria-modal', 'true');
		const inModal = document.createElement('button');
		inModal.textContent = 'In modal';
		modal.appendChild(inModal);
		document.body.appendChild(modal);
		inModal.focus();
		const notPrevented = inModal.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
		);
		expect(notPrevented).toBe(true);
		expect(inModal).toHaveFocus();
	});

	it('matches a toggle whose aria-controls lists several ids', async () => {
		mockMatchMedia();
		const toggle = addButton('Toggle', { 'aria-controls': 'other drawer' });
		const { rerender } = render(MobileNav, {
			props: { ...items, id: 'drawer', open: false, onClose: vi.fn() }
		});
		await rerender({ ...items, id: 'drawer', open: true, onClose: vi.fn() });
		await tick();
		await rerender({ ...items, id: 'drawer', open: false, onClose: vi.fn() });
		expect(toggle).toHaveFocus();
	});
});
