import { browser } from '$app/environment';

/**
 * Font-evaluation axis for the brand experiment. Drives a `data-font`
 * attribute on <html>, orthogonal to both `data-brand` (brandTheme) and the
 * dark/light mode owned by mode-watcher. `auto` clears the attribute: brand
 * themes fall back to Nata Sans, Legacy to the system stack.
 *
 * Nata Sans is the official brand font and remains the body/UI voice in every
 * option; the challengers only contest the display layer (h1–h3). See the
 * FONT AXIS section in `brand-themes.css` for the rationale per option.
 */
export type FontTheme = 'auto' | 'nata' | 'unbounded' | 'baloo' | 'system';

export const FONT_THEMES: { value: FontTheme; label: string; hint: string }[] = [
	{ value: 'auto', label: 'Auto', hint: 'Brand default' },
	{ value: 'nata', label: 'Nata Sans', hint: 'Official font, all text' },
	{ value: 'unbounded', label: 'Poster', hint: 'Unbounded titles only; Nata body' },
	{ value: 'baloo', label: 'Bubbly', hint: 'Baloo 2 titles only; Nata body' },
	{ value: 'system', label: 'System', hint: 'System stack, all text (control)' }
];

const STORAGE_KEY = 'revel-font';
const VALID = new Set<string>(FONT_THEMES.map((t) => t.value));

function isFont(v: unknown): v is FontTheme {
	return typeof v === 'string' && VALID.has(v);
}

function readInitial(): FontTheme {
	if (!browser) return 'auto';
	const fromDom = document.documentElement.dataset.font;
	if (isFont(fromDom) && fromDom !== 'auto') return fromDom;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return isFont(stored) ? stored : 'auto';
	} catch {
		return 'auto';
	}
}

export class FontThemeStore {
	current = $state<FontTheme>(readInitial());

	constructor() {
		if (browser) this.#applyToDom(this.current);
	}

	set(font: FontTheme) {
		this.current = font;
		if (!browser) return;
		this.#applyToDom(font);
		try {
			localStorage.setItem(STORAGE_KEY, font);
		} catch {
			// Ignore storage failures (private mode, quota, etc.).
		}
	}

	#applyToDom(font: FontTheme) {
		if (font === 'auto') {
			delete document.documentElement.dataset.font;
		} else {
			document.documentElement.dataset.font = font;
		}
	}
}

export const fontTheme = new FontThemeStore();
