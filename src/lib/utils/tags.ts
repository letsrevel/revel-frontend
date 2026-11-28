/**
 * Tag name helpers that mirror the backend's tag matching (BE #1540).
 *
 * The backend cleans a tag name (`strip().lstrip('#').strip()`) and matches it
 * case-insensitively with PostgreSQL `LOWER`, which also backs the unique
 * constraint on tag names. `tagKey` approximates that comparison in the
 * browser; the database stays the authority. Use `toLowerCase`, never
 * `toLocaleLowerCase`: a locale fold (for example Turkish dotted/dotless I)
 * would disagree with `LOWER` for the same user in some UI languages.
 *
 * `LOWER` maps one character at a time; `toLowerCase` does not in two known
 * cases, so `tagKey` maps them first (checked against PostgreSQL 15,
 * en_US.utf8): a capital sigma is always `σ` (JavaScript gives a word-final
 * `ς`), and `İ` (U+0130) is `i` (JavaScript gives `i` plus U+0307). A typed
 * `ς` stays `ς`, as in the database.
 */

/** Trims, removes every leading `#`, and trims again. Keeps the letter case. */
export function cleanTagName(name: string): string {
	return name.trim().replace(/^#+/, '').trim();
}

/** The comparison key of a tag name. Use it only to compare, never to store or show. */
export function tagKey(name: string): string {
	return cleanTagName(name).replace(/Σ/g, 'σ').replace(/İ/g, 'i').toLowerCase();
}

/** True when `list` holds a tag that matches `name` regardless of letter case. */
export function hasTag(list: readonly string[], name: string): boolean {
	const key = tagKey(name);
	return list.some((tag) => tagKey(tag) === key);
}

/**
 * Removes every tag in `list` that matches `name`. When none matches, appends
 * `name` as given (the casing of the chip the user clicked).
 */
export function toggleTag(list: readonly string[], name: string): string[] {
	const key = tagKey(name);
	const rest = list.filter((tag) => tagKey(tag) !== key);
	return rest.length === list.length ? [...list, name] : rest;
}

/** Keeps the first tag of each key, in order. Drops names that clean to empty. */
export function dedupeTags(list: readonly string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const tag of list) {
		const key = tagKey(tag);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		result.push(tag);
	}
	return result;
}

/**
 * The tags to add and to remove so that `initial` becomes `current`, compared
 * by key. A change in letter case only is no change: the backend keeps the
 * stored casing, and a remove would match (and delete) the stored tag.
 */
export function diffTags(
	initial: readonly string[],
	current: readonly string[]
): { added: string[]; removed: string[] } {
	return {
		added: current.filter((tag) => !hasTag(initial, tag)),
		removed: initial.filter((tag) => !hasTag(current, tag))
	};
}

/**
 * Parses a comma-separated `?tags=` value. Removes case duplicates and names
 * that clean to empty, so the server load and the client filter state agree.
 * Returns `undefined` when no tag remains.
 */
export function parseTagsParam(raw: string | null | undefined): string[] | undefined {
	if (!raw) return undefined;
	const tags = dedupeTags(raw.split(','));
	return tags.length > 0 ? tags : undefined;
}

/**
 * Replaces each tag in `current` with its spelling in `stored` when the keys
 * match. After a save, the snapshot then shows the casing the backend keeps
 * (a case-only edit sends no request, so the stored casing does not change).
 */
export function keepStoredCasing(current: readonly string[], stored: readonly string[]): string[] {
	return current.map((tag) => stored.find((s) => tagKey(s) === tagKey(tag)) ?? tag);
}
