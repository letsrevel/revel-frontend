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

	it('set("a") writes the attribute and persists', async () => {
		const { brandTheme } = await import('./brandTheme.svelte');
		brandTheme.set('a');
		expect(brandTheme.current).toBe('a');
		expect(document.documentElement.dataset.brand).toBe('a');
		expect(localStorage.getItem('revel-brand')).toBe('a');
	});

	it('set("legacy") removes the attribute', async () => {
		const { brandTheme } = await import('./brandTheme.svelte');
		brandTheme.set('b');
		brandTheme.set('legacy');
		expect(document.documentElement.dataset.brand).toBeUndefined();
		expect(localStorage.getItem('revel-brand')).toBe('legacy');
	});

	it('reads initial value from an existing data-brand attribute', async () => {
		document.documentElement.dataset.brand = 'b';
		const { BrandThemeStore } = await import('./brandTheme.svelte');
		const store = new BrandThemeStore();
		expect(store.current).toBe('b');
	});

	it('does not throw when localStorage.setItem throws', async () => {
		const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		const { brandTheme } = await import('./brandTheme.svelte');
		expect(() => brandTheme.set('a')).not.toThrow();
		spy.mockRestore();
	});
});
