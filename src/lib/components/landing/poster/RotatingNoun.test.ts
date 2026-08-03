import { render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RotatingNoun from './RotatingNoun.svelte';

function mockMatchMedia(reduced: boolean) {
	vi.stubGlobal(
		'matchMedia',
		vi.fn().mockReturnValue({
			matches: reduced,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		})
	);
}

describe('RotatingNoun', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('is hidden from assistive tech and shows the first item initially', () => {
		mockMatchMedia(false);
		const { container } = render(RotatingNoun, {
			props: { items: ['party 🎉', 'show 🎭', 'night ✨'] }
		});
		const root = container.querySelector('.rotating-noun') as HTMLElement;
		expect(root.getAttribute('aria-hidden')).toBe('true');
		expect(root.querySelector('.is-active')?.textContent).toContain('party');
	});

	it('advances to the next item after the interval', async () => {
		mockMatchMedia(false);
		const { container } = render(RotatingNoun, {
			props: { items: ['party 🎉', 'show 🎭'], intervalMs: 1000 }
		});
		await vi.advanceTimersByTimeAsync(1100);
		expect(container.querySelector('.is-active')?.textContent).toContain('show');
	});

	it('does not rotate under prefers-reduced-motion', async () => {
		mockMatchMedia(true);
		const { container } = render(RotatingNoun, {
			props: { items: ['party 🎉', 'show 🎭'], intervalMs: 1000 }
		});
		await vi.advanceTimersByTimeAsync(3000);
		expect(container.querySelector('.is-active')?.textContent).toContain('party');
	});
});
