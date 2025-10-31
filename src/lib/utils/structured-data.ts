import type { EventDetailSchema } from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';

/**
 * Schema.org Event structured data for SEO
 * https://schema.org/Event
 */
export interface EventStructuredData {
	'@context': 'https://schema.org';
	'@type': 'Event';
	name: string;
	description?: string;
	startDate: string;
	endDate: string;
	eventStatus: string;
	eventAttendanceMode: string;
	location: {
		'@type': 'Place';
		name?: string;
		address?: {
			'@type': 'PostalAddress';
			addressLocality?: string;
			addressCountry?: string;
			streetAddress?: string;
		};
	};
	organizer: {
		'@type': 'Organization';
		name: string;
		url?: string;
	};
	image?: string[];
	offers?: {
		'@type': 'Offer';
		url: string;
		price?: string;
		priceCurrency?: string;
		availability: string;
		validFrom?: string;
	};
}

/**
 * Generate Schema.org structured data for an event
 */
export function generateEventStructuredData(
	event: EventDetailSchema,
	eventUrl: string
): EventStructuredData {
	const structuredData: EventStructuredData = {
		'@context': 'https://schema.org',
		'@type': 'Event',
		name: event.name,
		description: event.description || undefined,
		startDate: event.start,
		endDate: event.end,
		eventStatus: getEventStatus(event.status),
		eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', // Physical events
		location: {
			'@type': 'Place',
			name: event.city?.name,
			address: event.address
				? {
						'@type': 'PostalAddress',
						streetAddress: event.address,
						addressLocality: event.city?.name,
						addressCountry: event.city?.country
					}
				: undefined
		},
		organizer: {
			'@type': 'Organization',
			name: event.organization.name
		}
	};

	// Add images with backend URLs, following hierarchy
	const images = [
		event.logo,
		event.cover_art,
		event.event_series?.logo,
		event.event_series?.cover_art,
		event.organization.logo,
		event.organization.cover_art
	]
		.filter((img): img is string => img !== null && img !== undefined)
		.map((img) => getBackendUrl(img));

	if (images.length > 0) {
		structuredData.image = images;
	}

	// Add offer information
	if (!event.requires_ticket) {
		// Free RSVP event
		const isFull =
			event.max_attendees !== undefined &&
			event.max_attendees > 0 &&
			event.attendee_count >= event.max_attendees;

		structuredData.offers = {
			'@type': 'Offer',
			url: eventUrl,
			price: '0',
			priceCurrency: 'USD',
			availability: isFull ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
			validFrom: event.rsvp_before || event.start
		};
	}
	// Note: For ticketed events, we'd need ticket tier information
	// which isn't in EventDetailSchema. Could be added in future.

	return structuredData;
}

/**
 * Convert event status to Schema.org eventStatus
 */
function getEventStatus(_status: EventDetailSchema['status']): string {
	// For now, all events are scheduled
	// In the future, we can map specific statuses to EventCancelled, EventPostponed, etc.
	return 'https://schema.org/EventScheduled';
}

/**
 * Convert structured data to JSON-LD script tag content
 */
export function structuredDataToJsonLd(data: EventStructuredData): string {
	return JSON.stringify(data, null, 0); // No whitespace for production
}
