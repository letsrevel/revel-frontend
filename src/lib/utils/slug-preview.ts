/**
 * Display-only preview of an organization's public slug. The backend owns the
 * real slug; this mirrors Django's slugify closely enough for the hint text
 * ("Münchner Club" -> "munchner-club").
 */
export function slugPreview(value: string): string {
	const slug = value
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'your-org';
}
