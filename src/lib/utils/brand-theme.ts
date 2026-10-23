/**
 * Organization brand colors → theme-token overrides (#1053).
 *
 * The backend owns every contrast decision (revel-backend #1149): for each mode
 * it shifts the org's entered color in lightness until it clears the worse of
 * `--background` and `--card` (primary ≥ 4.5:1, accent ≥ 3:1), then picks the
 * #000/#FFF foreground with the higher contrast (≥ 4.5:1). This module only
 * converts those hex values into the HSL-triplet grammar our tokens use
 * (`270 70% 48%`, consumed as `hsl(var(--primary))`) and scopes them per mode.
 * It never adjusts a color itself: a second implementation of the lightness
 * walk would drift from the server's and the page would lie about what passed.
 *
 * Output is built ONLY from numbers parsed out of a strict `#RRGGBB` match, so
 * the CSS string can be injected into a `<style>` without escaping: a value
 * that is not a 6-digit hex is dropped, never interpolated.
 */

/** One mode's colors, as `brand_theme.light` / `brand_theme.dark` carry them. */
export interface BrandModeColors {
	primary: string;
	primary_foreground: string;
	accent?: string | null;
	accent_foreground?: string | null;
}

/** Structural mirror of the API's `brand_theme` (null when no primary is set). */
export interface BrandThemeInput {
	light: BrandModeColors;
	dark: BrandModeColors;
}

const HEX_RE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** Two decimals: integer rounding can nudge a color tuned to sit exactly on a
 *  contrast floor (e.g. 4.50:1) just under it once the browser converts back. */
function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

/**
 * `#RRGGBB` → `"H S% L%"` (the token grammar). Returns null for anything that is
 * not a strict 6-digit hex.
 */
export function hexToHslTriplet(hex: string): string | null {
	const match = HEX_RE.exec(hex.trim());
	if (!match) return null;

	const [r, g, b] = match.slice(1).map((part) => Number.parseInt(part, 16) / 255);
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const lightness = (max + min) / 2;
	const delta = max - min;

	let hue = 0;
	let saturation = 0;
	if (delta !== 0) {
		saturation = delta / (1 - Math.abs(2 * lightness - 1));
		if (max === r) hue = ((g - b) / delta) % 6;
		else if (max === g) hue = (b - r) / delta + 2;
		else hue = (r - g) / delta + 4;
		hue *= 60;
		if (hue < 0) hue += 360;
	}

	return `${round2(hue)} ${round2(saturation * 100)}% ${round2(lightness * 100)}%`;
}

/**
 * The token declarations for one mode. `--ring` follows `--primary`, as it does
 * in app.css. Accent tokens are emitted only when the org set an accent; with
 * no accent the Revel accent stays in place.
 */
function modeDeclarations(colors: BrandModeColors): string | null {
	const primary = hexToHslTriplet(colors.primary);
	const primaryForeground = hexToHslTriplet(colors.primary_foreground);
	if (!primary || !primaryForeground) return null;

	const declarations = [
		`--primary:${primary}`,
		`--primary-foreground:${primaryForeground}`,
		`--ring:${primary}`
	];

	const accent = colors.accent ? hexToHslTriplet(colors.accent) : null;
	const accentForeground = colors.accent_foreground
		? hexToHslTriplet(colors.accent_foreground)
		: null;
	if (accent && accentForeground) {
		declarations.push(`--accent:${accent}`, `--accent-foreground:${accentForeground}`);
	}

	return declarations.join(';');
}

/**
 * Stylesheet text overriding the brand tokens on `<html>` for both modes, or
 * null when there is nothing (valid) to apply. Also re-points the mode-inert
 * `--poster-band` ribbon (org/event/series headers) at the org's light primary.
 *
 * Scoped to the document root, not a page wrapper, on purpose: dialogs,
 * popovers, sheets and toasts portal to `<body>`, so tokens set on a wrapper
 * would leave every checkout sheet and RSVP dialog on Revel purple. The
 * selectors (0,2,0) also outrank app.css's `:root` / `.dark` (0,1,0), which sit
 * in `@layer base` and would lose to this unlayered sheet anyway. Both modes
 * key off the same `.dark` class app.html's anti-FOUC script and the embed
 * `?theme=` toggle put on `<html>`.
 */
export function buildBrandThemeCss(theme: BrandThemeInput | null | undefined): string | null {
	if (!theme) return null;
	const light = modeDeclarations(theme.light);
	const dark = modeDeclarations(theme.dark);
	if (!light || !dark) return null;
	// The org-page ribbon is mode-inert (imagery rule), so it takes the LIGHT
	// primary in both modes: the one guaranteed >= 4.5:1 against the white
	// sticker chip that sits on it. modeDeclarations already validated it.
	const band = `--poster-band:${hexToHslTriplet(theme.light.primary)}`;
	return `:root:not(.dark){${light};${band}}:root.dark{${dark};${band}}`;
}
