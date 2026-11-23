import { render, screen } from '@testing-library/svelte';
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
		mockMatchMedia(true);
		const onClose = vi.fn();
		render(MobileNav, { props: { ...base, open: true, onClose } });
		expect(onClose).toHaveBeenCalled();
	});

	it('hides the backdrop with the same breakpoint class as the drawer', () => {
		mockMatchMedia();
		const { container } = render(MobileNav, { props: { ...base, open: true, onClose: vi.fn() } });
		const backdrop = container.querySelector('[role="presentation"]');
		expect(backdrop).toHaveClass('md:hidden');
		expect(screen.getByRole('dialog', { hidden: true })).toHaveClass('md:hidden');
	});

	it('uses xl:hidden on the backdrop for a wide nav', () => {
		mockMatchMedia();
		const { container } = render(MobileNav, {
			props: { ...base, open: true, onClose: vi.fn(), wideNav: true }
		});
		expect(container.querySelector('[role="presentation"]')).toHaveClass('xl:hidden');
	});
});
