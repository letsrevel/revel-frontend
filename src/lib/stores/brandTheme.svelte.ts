import { browser } from '$app/environment';

/**
 * Brand-identity evaluation. Drives a `data-brand` attribute on <html>,
 * orthogonal to the dark/light mode owned by mode-watcher. `legacy` clears the
 * attribute, falling back to the untouched current brand.
 *
 * Each non-legacy theme commits to a distinct SURFACE strategy (see
 * `brand-themes.css`) so they read as clearly different, not sibling tints.
 */
export type BrandTheme = 'legacy' | 'gradient' | 'midnight' | 'bubble' | 'mono';

export const BRAND_THEMES: { value: BrandTheme; label: string; hint: string }[] = [
	{ value: 'legacy', label: 'Legacy', hint: 'Current brand' },
	{ value: 'gradient', label: 'Gradient', hint: 'Full-page purple→crimson wash' },
	{ value: 'midnight', label: 'Midnight', hint: 'Neon on ink; paper by day' },
	{ value: 'bubble', label: 'Bubble', hint: 'Playful, sticker-round, lavender' },
	{ value: 'mono', label: 'Mono', hint: 'Stark black & white' }
];

const STORAGE_KEY = 'revel-brand';
const VALID = new Set<string>(BRAND_THEMES.map((t) => t.value));

function isBrand(v: unknown): v is BrandTheme {
	return typeof v === 'string' && VALID.has(v);
}

function readInitial(): BrandTheme {
	if (!browser) return 'legacy';
	const fromDom = document.documentElement.dataset.brand;
	if (isBrand(fromDom) && fromDom !== 'legacy') return fromDom;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return isBrand(stored) ? stored : 'legacy';
	} catch {
		return 'legacy';
	}
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
