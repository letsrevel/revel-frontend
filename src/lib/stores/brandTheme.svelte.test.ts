import { describe, it, expect, beforeEach, vi } from 'vitest';

// The store reads `browser` from $app/environment at construction; force it on
// so the jsdom document/localStorage paths execute.
vi.mock('$app/environment', () => ({ browser: true }));

describe('brandTheme store', () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.clear();
		delete document.documentElement.dataset.brand;
	});

	it('defaults to legacy with no attribute and no storage', async () => {
		const { brandTheme } = await import('./brandTheme.svelte');
		expect(brandTheme.current).toBe('legacy');
		expect(document.documentElement.dataset.brand).toBeUndefined();
	});

	it('set("midnight") writes the attribute and persists', async () => {
		const { brandTheme } = await import('./brandTheme.svelte');
		brandTheme.set('midnight');
		expect(brandTheme.current).toBe('midnight');
		expect(document.documentElement.dataset.brand).toBe('midnight');
		expect(localStorage.getItem('revel-brand')).toBe('midnight');
	});

	it('set("legacy") removes the attribute', async () => {
		const { brandTheme } = await import('./brandTheme.svelte');
		brandTheme.set('gradient');
		brandTheme.set('legacy');
		expect(document.documentElement.dataset.brand).toBeUndefined();
		expect(localStorage.getItem('revel-brand')).toBe('legacy');
	});

	it('reads initial value from an existing data-brand attribute', async () => {
		document.documentElement.dataset.brand = 'bubble';
		const { BrandThemeStore } = await import('./brandTheme.svelte');
		const store = new BrandThemeStore();
		expect(store.current).toBe('bubble');
	});

	it('ignores an unknown stored value and falls back to legacy', async () => {
		localStorage.setItem('revel-brand', 'bogus');
		const { BrandThemeStore } = await import('./brandTheme.svelte');
		const store = new BrandThemeStore();
		expect(store.current).toBe('legacy');
	});

	it('does not throw when localStorage.setItem throws', async () => {
		const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		const { brandTheme } = await import('./brandTheme.svelte');
		expect(() => brandTheme.set('mono')).not.toThrow();
		spy.mockRestore();
	});
});
