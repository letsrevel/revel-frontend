import type { OrganizationRetrieveSchema } from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';

export interface OrganizationJsonLd {
	'@context': 'https://schema.org';
	'@type': 'Organization';
	name: string;
	description?: string;
	url?: string;
	logo?: string;
	image?: string;
	address?: {
		'@type': 'PostalAddress';
		streetAddress?: string;
		addressLocality?: string;
		addressCountry?: string;
	};
}

function stripHtml(html: string | null | undefined): string {
	if (!html) return '';
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function generateOrganizationJsonLd(
	org: OrganizationRetrieveSchema,
	orgUrl: string
): OrganizationJsonLd {
	const imageRel = org.cover_art_social_url || org.cover_art || org.logo;
	const ld: OrganizationJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: org.name,
		description: stripHtml(org.description) || undefined,
		url: orgUrl,
		logo: org.logo ? getBackendUrl(org.logo) : undefined,
		image: imageRel ? getBackendUrl(imageRel) : undefined
	};
	if (org.address || org.city) {
		ld.address = {
			'@type': 'PostalAddress',
			streetAddress: org.address || undefined,
			addressLocality: org.city?.name,
			addressCountry: org.city?.country
		};
	}
	return ld;
}
