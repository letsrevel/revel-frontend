import type { VenueDetailSchema } from '$lib/api/generated/types.gen';

interface VenueFields {
	venue_id?: string | null;
	city_id?: number | null;
	address?: string | null;
}

/**
 * Form fields after (de)selecting a venue: a venue with a city also sets the
 * city, and its address is copied; clearing the venue only clears `venue_id`.
 */
export function applyVenue<T extends VenueFields>(form: T, venue: VenueDetailSchema | null): T {
	if (!venue) return { ...form, venue_id: null };
	const address = venue.address || null;
	return venue.city
		? { ...form, venue_id: venue.id, city_id: venue.city.id, address }
		: { ...form, venue_id: venue.id, address };
}
