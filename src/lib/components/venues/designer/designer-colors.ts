/**
 * Pure price-category → seat-style resolution for the designer canvas.
 *
 * The designer only DISPLAYS the paint applied in the grid editor: each seat
 * carries a `priceCategoryId` and the venue exposes its price categories
 * (id → color + name). This builds the lookup map and resolves a seat's
 * category style, mirroring SeatMap.svelte's "color is an accent that always
 * pairs with the category name" rule — the returned `name` is what the seat's
 * aria-label/title must include so color is never the only signal.
 *
 * Unpainted seats (null/undefined id) and seats pointing at an unknown category
 * both resolve to `null` → the neutral (theme-token) seat style.
 */
import type { PriceCategorySchema } from '$lib/api/generated/types.gen';

/** The two signals a painted seat needs: its accent color and category name. */
export interface SeatCategoryStyle {
	/** Org-defined hex color (raw, only ever applied paired with `name`). */
	color: string;
	/** Category name — required in the seat's accessible name/title. */
	name: string;
}

/**
 * Build an id → {color, name} lookup from the venue's price categories.
 * Categories without a stable id are skipped (they can't tag a seat).
 */
export function buildCategoryStyleMap(
	categories: PriceCategorySchema[]
): Map<string, SeatCategoryStyle> {
	const map = new Map<string, SeatCategoryStyle>();
	for (const category of categories) {
		if (typeof category.id === 'string' && category.id) {
			map.set(category.id, { color: category.color, name: category.name });
		}
	}
	return map;
}

/**
 * Resolve a seat's painted category style, or `null` for the neutral style.
 * Null/undefined id → unpainted; unknown id → treated as unpainted (neutral).
 */
export function resolveSeatCategory(
	priceCategoryId: string | null | undefined,
	styles: Map<string, SeatCategoryStyle>
): SeatCategoryStyle | null {
	if (!priceCategoryId) return null;
	return styles.get(priceCategoryId) ?? null;
}
