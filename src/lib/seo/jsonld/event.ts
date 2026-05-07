import type { EventDetailSchema } from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';

interface PlaceLD {
	'@type': 'Place';
	name?: string;
	address?: {
		'@type': 'PostalAddress';
		streetAddress?: string;
		addressLocality?: string;
		addressCountry?: string;
	};
}

export interface EventJsonLd {
	'@context': 'https://schema.org';
	'@type': 'Event';
	name: string;
	description?: string;
	startDate: string;
	endDate: string;
	eventStatus: string;
	eventAttendanceMode: string;
	location: PlaceLD;
	organizer: { '@type': 'Organization'; name: string };
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

function buildLocation(event: EventDetailSchema): PlaceLD {
	const venueName = (event as unknown as { venue?: { name?: string } }).venue?.name;
	const place: PlaceLD = { '@type': 'Place', name: venueName || event.city?.name };
	if (event.address || event.city) {
		place.address = {
			'@type': 'PostalAddress',
			streetAddress: event.address || undefined,
			addressLocality: event.city?.name,
			addressCountry: event.city?.country
		};
	}
	return place;
}

export function generateEventJsonLd(event: EventDetailSchema, eventUrl: string): EventJsonLd {
	const startDate = event.start || new Date().toISOString();
	const endDate = event.end || startDate;

	const ld: EventJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'Event',
		name: event.name,
		description: event.description || undefined,
		startDate,
		endDate,
		eventStatus: 'https://schema.org/EventScheduled',
		eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
		location: buildLocation(event),
		organizer: { '@type': 'Organization', name: event.organization.name }
	};

	const images = [
		event.logo,
		event.cover_art,
		event.event_series?.logo,
		event.event_series?.cover_art,
		event.organization.logo,
		event.organization.cover_art
	]
		.filter((img): img is string => img != null)
		.map((img) => getBackendUrl(img));
	if (images.length > 0) ld.image = images;

	if (!event.requires_ticket) {
		const isFull =
			event.max_attendees !== undefined &&
			event.max_attendees > 0 &&
			event.attendee_count >= event.max_attendees;
		ld.offers = {
			'@type': 'Offer',
			url: eventUrl,
			price: '0',
			priceCurrency: 'USD',
			availability: isFull ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
			validFrom: event.rsvp_before || event.start || undefined
		};
	}

	return ld;
}
