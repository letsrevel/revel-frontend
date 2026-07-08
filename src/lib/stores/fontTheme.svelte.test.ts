import { describe, it, expect, beforeEach, vi } from 'vitest';

// The store reads `browser` from $app/environment at construction; force it on
// so the jsdom document/localStorage paths execute.
vi.mock('$app/environment', () => ({ browser: true }));

describe('fontTheme store', () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.clear();
		delete document.documentElement.dataset.font;
	});

	it('defaults to auto with no attribute and no storage', async () => {
		const { fontTheme } = await import('./fontTheme.svelte');
		expect(fontTheme.current).toBe('auto');
		expect(document.documentElement.dataset.font).toBeUndefined();
	});

	it('set("unbounded") writes the attribute and persists', async () => {
		const { fontTheme } = await import('./fontTheme.svelte');
		fontTheme.set('unbounded');
		expect(fontTheme.current).toBe('unbounded');
		expect(document.documentElement.dataset.font).toBe('unbounded');
		expect(localStorage.getItem('revel-font')).toBe('unbounded');
	});

	it('set("auto") removes the attribute', async () => {
		const { fontTheme } = await import('./fontTheme.svelte');
		fontTheme.set('baloo');
		fontTheme.set('auto');
		expect(document.documentElement.dataset.font).toBeUndefined();
		expect(localStorage.getItem('revel-font')).toBe('auto');
	});

	it('reads initial value from an existing data-font attribute', async () => {
		document.documentElement.dataset.font = 'baloo';
		const { FontThemeStore } = await import('./fontTheme.svelte');
		const store = new FontThemeStore();
		expect(store.current).toBe('baloo');
	});

	it('ignores an unknown stored value and falls back to auto', async () => {
		localStorage.setItem('revel-font', 'comic-sans');
		const { FontThemeStore } = await import('./fontTheme.svelte');
		const store = new FontThemeStore();
		expect(store.current).toBe('auto');
	});

	it('does not throw when localStorage.setItem throws', async () => {
		const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		const { fontTheme } = await import('./fontTheme.svelte');
		expect(() => fontTheme.set('nata')).not.toThrow();
		spy.mockRestore();
	});
});
