/**
 * Display-only preview of an organization's public slug. The backend owns the
 * real slug; this mirrors Django's slugify closely enough for the hint text
 * ("Münchner Club" -> "munchner-club").
 *
 * Returns `null` when no slug can be derived (empty input, or input made only
 * of characters that don't survive normalization, such as "東京"). Callers decide
 * what to show instead; this must never invent a placeholder slug.
 */
export function slugPreview(name: string): string | null {
	const slug = name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || null;
}
