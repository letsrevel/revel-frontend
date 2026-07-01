import { browser } from '$app/environment';

/**
 * Brand-identity evaluation (Legacy / A / B). Drives a `data-brand` attribute
 * on <html>, orthogonal to the dark/light mode owned by mode-watcher. `legacy`
 * clears the attribute, falling back to the untouched current brand.
 */
export type BrandTheme = 'legacy' | 'a' | 'b';

export const BRAND_THEMES: { value: BrandTheme; label: string; hint: string }[] = [
	{ value: 'legacy', label: 'Legacy', hint: 'Current brand' },
	{ value: 'a', label: 'A', hint: 'Loud / expressive' },
	{ value: 'b', label: 'B', hint: 'Refined / editorial' }
];

const STORAGE_KEY = 'revel-brand';

function isBrand(v: unknown): v is BrandTheme {
	return v === 'legacy' || v === 'a' || v === 'b';
}

function readInitial(): BrandTheme {
	if (!browser) return 'legacy';
	const fromDom = document.documentElement.dataset.brand;
	if (fromDom === 'a' || fromDom === 'b') return fromDom;
	const stored = localStorage.getItem(STORAGE_KEY);
	return isBrand(stored) ? stored : 'legacy';
}

export class BrandThemeStore {
	current = $state<BrandTheme>(readInitial());

	constructor() {
		if (browser) this.#applyToDom(this.current);
	}

	set(theme: BrandTheme) {
		this.current = theme;
		if (!browser) return;
		this.#applyToDom(theme);
		try {
			localStorage.setItem(STORAGE_KEY, theme);
		} catch {
			// Ignore storage failures (private mode, quota, etc.).
		}
	}

	#applyToDom(theme: BrandTheme) {
		if (theme === 'legacy') {
			delete document.documentElement.dataset.brand;
		} else {
			document.documentElement.dataset.brand = theme;
		}
	}
}

export const brandTheme = new BrandThemeStore();
