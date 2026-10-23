/** TanStack query key for an organization's custom domain. */
export function customDomainQueryKey(slug: string): readonly ['org-custom-domain', string] {
	return ['org-custom-domain', slug];
}
