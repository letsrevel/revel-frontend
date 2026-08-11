/**
 * Turn a human name (event, pass, organization) into a safe filename stem for a
 * generated download.
 *
 * Shared by the wallet/PDF download buttons, which each grew their own copy of
 * this and each kept the same defect: trailing punctuation survived as a dangling
 * hyphen, so "Acme Collective!" produced `acme-collective--membership.pkpass`.
 */
export function toFilenameSlug(name: string, fallback = 'download'): string {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.substring(0, 30)
		// After the cap, not before: truncation can land on a separator.
		.replace(/^-+|-+$/g, '');
	return slug || fallback;
}
