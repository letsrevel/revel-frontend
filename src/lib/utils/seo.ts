import type {
	EventDetailSchema,
	OrganizationRetrieveSchema,
	EventSeriesRetrieveSchema
} from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';

/**
 * SEO utility functions for generating meta tags, descriptions, and structured data
 */

/**
 * Truncate text to a specific length with ellipsis
 */
export function truncate(text: string | null | undefined, maxLength: number): string {
	if (!text) return '';
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength - 3) + '...';
}

/**
 * Strip HTML tags from a string for plain text descriptions
 */
export function stripHtml(html: string | null | undefined): string {
	if (!html) return '';
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Get preview image for an event following the priority hierarchy:
 * 1. event.logo
 * 2. event.cover_art
 * 3. event.event_series.logo
 * 4. event.event_series.cover_art
 * 5. event.organization.logo
 * 6. event.organization.cover_art
 *
 * Returns absolute URL relative to backend
 */
export function getEventPreviewImage(event: EventDetailSchema): string | undefined {
	const candidates = [
		event.logo,
		event.cover_art,
		event.event_series?.logo,
		event.event_series?.cover_art,
		event.organization.logo,
		event.organization.cover_art
	];

	const firstAvailable = candidates.find((url) => url != null);
	return firstAvailable ? getBackendUrl(firstAvailable) : undefined;
}

/**
 * Get preview image for an organization following the priority hierarchy:
 * 1. organization.logo
 * 2. organization.cover_art
 *
 * Returns absolute URL relative to backend
 */
export function getOrganizationPreviewImage(
	organization: OrganizationRetrieveSchema
): string | undefined {
	const candidates = [organization.logo, organization.cover_art];

	const firstAvailable = candidates.find((url) => url != null);
	return firstAvailable ? getBackendUrl(firstAvailable) : undefined;
}

/**
 * Get preview image for an event series following the priority hierarchy:
 * 1. series.logo
 * 2. series.cover_art
 * 3. series.organization.logo
 * 4. series.organization.cover_art
 *
 * Returns absolute URL relative to backend
 */
export function getEventSeriesPreviewImage(series: EventSeriesRetrieveSchema): string | undefined {
	const candidates = [
		series.logo,
		series.cover_art,
		series.organization.logo,
		series.organization.cover_art
	];

	const firstAvailable = candidates.find((url) => url != null);
	return firstAvailable ? getBackendUrl(firstAvailable) : undefined;
}

/**
 * Meta tag configuration interface
 */
export interface MetaTags {
	title: string;
	description: string;
	canonical?: string;
	ogType?: 'website' | 'profile' | 'event' | 'article';
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	ogUrl?: string;
	twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
	twitterTitle?: string;
	twitterDescription?: string;
	twitterImage?: string;
}

/**
 * Generate meta tags for an event
 */
export function generateEventMeta(event: EventDetailSchema, eventUrl: string): MetaTags {
	const description = event.description ? stripHtml(event.description) : '';
	const truncatedDescription = truncate(description, 155);

	// Get preview image following priority hierarchy
	const imageUrl = getEventPreviewImage(event);

	return {
		title: `${event.name} | Revel`,
		description:
			truncatedDescription || `Join ${event.name} organized by ${event.organization.name}`,
		canonical: eventUrl,
		ogType: 'event',
		ogTitle: event.name,
		ogDescription: description || `Join ${event.name} organized by ${event.organization.name}`,
		ogImage: imageUrl,
		ogUrl: eventUrl,
		twitterCard: 'summary_large_image',
		twitterTitle: event.name,
		twitterDescription: truncate(description, 200) || `Join ${event.name}`,
		twitterImage: imageUrl
	};
}

/**
 * Generate meta tags for an organization
 */
export function generateOrganizationMeta(
	organization: OrganizationRetrieveSchema,
	orgUrl: string
): MetaTags {
	const description = organization.description ? stripHtml(organization.description) : '';
	const truncatedDescription = truncate(description, 155);

	// Get preview image following priority hierarchy
	const imageUrl = getOrganizationPreviewImage(organization);

	return {
		title: `${organization.name} | Revel`,
		description:
			truncatedDescription || `${organization.name} on Revel - Community events and experiences`,
		canonical: orgUrl,
		ogType: 'profile',
		ogTitle: organization.name,
		ogDescription: description || `${organization.name} on Revel`,
		ogImage: imageUrl,
		ogUrl: orgUrl,
		twitterCard: 'summary_large_image',
		twitterTitle: organization.name,
		twitterDescription: truncate(description, 200) || `${organization.name} on Revel`,
		twitterImage: imageUrl
	};
}

/**
 * Generate meta tags for the home page
 */
export function generateHomeMeta(baseUrl: string): MetaTags {
	return {
		title: 'Revel - Community-Focused Event Management',
		description:
			'Discover community events, connect with organizers, and create unforgettable experiences. Open-source event management and ticketing platform.',
		canonical: baseUrl,
		ogType: 'website',
		ogTitle: 'Revel - Community-Focused Event Management',
		ogDescription:
			'Discover community events, connect with organizers, and create unforgettable experiences.',
		ogUrl: baseUrl,
		twitterCard: 'summary_large_image',
		twitterTitle: 'Revel - Community Events',
		twitterDescription: 'Discover community events and create unforgettable experiences'
	};
}

/**
 * Generate meta tags for the events listing page
 */
export function generateEventsListingMeta(baseUrl: string): MetaTags {
	return {
		title: 'Browse Events | Revel',
		description:
			'Discover community events happening near you. Find concerts, workshops, meetups, and more on Revel.',
		canonical: `${baseUrl}/events`,
		ogType: 'website',
		ogTitle: 'Browse Events | Revel',
		ogDescription: 'Discover community events happening near you.',
		ogUrl: `${baseUrl}/events`,
		twitterCard: 'summary_large_image',
		twitterTitle: 'Browse Events | Revel',
		twitterDescription: 'Discover community events near you'
	};
}

/**
 * Ensure image URLs are absolute
 */
export function ensureAbsoluteUrl(url: string | undefined, baseUrl: string): string | undefined {
	if (!url) return undefined;

	// Already absolute
	if (url.startsWith('http://') || url.startsWith('https://')) {
		return url;
	}

	// Relative URL - make absolute
	return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Generate organization structured data
 */
export interface OrganizationStructuredData {
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

export function generateOrganizationStructuredData(
	organization: OrganizationRetrieveSchema,
	orgUrl: string
): OrganizationStructuredData {
	const imageUrl = getOrganizationPreviewImage(organization);

	const structuredData: OrganizationStructuredData = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: organization.name,
		description: stripHtml(organization.description || '') || undefined,
		url: orgUrl,
		logo: organization.logo ? getBackendUrl(organization.logo) : undefined,
		image: imageUrl
	};

	// Add address if available
	if (organization.address || organization.city) {
		structuredData.address = {
			'@type': 'PostalAddress',
			streetAddress: organization.address || undefined,
			addressLocality: organization.city?.name,
			addressCountry: organization.city?.country
		};
	}

	return structuredData;
}

/**
 * Convert structured data to JSON-LD string
 */
export function toJsonLd<T extends Record<string, unknown>>(data: T): string {
	return JSON.stringify(data, null, 0);
}

/**
 * Generate meta tags for an event series
 */
export function generateEventSeriesMeta(
	series: EventSeriesRetrieveSchema,
	seriesUrl: string
): MetaTags {
	const description = series.description ? stripHtml(series.description) : '';
	const truncatedDescription = truncate(description, 155);

	// Get preview image following priority hierarchy
	const imageUrl = getEventSeriesPreviewImage(series);

	return {
		title: `${series.name} | ${series.organization.name} | Revel`,
		description:
			truncatedDescription || `${series.name} - Event series by ${series.organization.name}`,
		canonical: seriesUrl,
		ogType: 'website',
		ogTitle: `${series.name} | ${series.organization.name}`,
		ogDescription: description || `${series.name} - Event series by ${series.organization.name}`,
		ogImage: imageUrl,
		ogUrl: seriesUrl,
		twitterCard: 'summary_large_image',
		twitterTitle: `${series.name} | ${series.organization.name}`,
		twitterDescription:
			truncate(description, 200) || `${series.name} - Event series by ${series.organization.name}`,
		twitterImage: imageUrl
	};
}

/**
 * Generate event series structured data
 */
export interface EventSeriesStructuredData {
	'@context': 'https://schema.org';
	'@type': 'EventSeries';
	name: string;
	description?: string;
	url: string;
	organizer: {
		'@type': 'Organization';
		name: string;
	};
	image?: string[];
}

export function generateEventSeriesStructuredData(
	series: EventSeriesRetrieveSchema,
	seriesUrl: string
): EventSeriesStructuredData {
	const structuredData: EventSeriesStructuredData = {
		'@context': 'https://schema.org',
		'@type': 'EventSeries',
		name: series.name,
		description: stripHtml(series.description || '') || undefined,
		url: seriesUrl,
		organizer: {
			'@type': 'Organization',
			name: series.organization.name
		}
	};

	// Add images with backend URLs
	const images = [
		series.logo,
		series.cover_art,
		series.organization.logo,
		series.organization.cover_art
	]
		.filter((img): img is string => img !== null && img !== undefined)
		.map((img) => getBackendUrl(img));

	if (images.length > 0) {
		structuredData.image = images;
	}

	return structuredData;
}
