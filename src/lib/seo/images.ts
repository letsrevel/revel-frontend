import type {
	EventDetailSchema,
	OrganizationRetrieveSchema,
	EventSeriesRetrieveSchema
} from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';

/** Best share image for each page kind: the most specific cover/logo the payload carries. */
export function getEventImage(event: EventDetailSchema): string | undefined {
	const e = event as unknown as {
		cover_art_social_url?: string;
		event_series?: { cover_art_social_url?: string };
		organization?: { cover_art_social_url?: string };
	};
	const candidates = [
		e.cover_art_social_url,
		event.cover_art,
		e.event_series?.cover_art_social_url,
		event.event_series?.cover_art,
		e.organization?.cover_art_social_url,
		event.organization.cover_art,
		event.logo,
		event.organization.logo
	];
	const first = candidates.find((c) => c != null);
	return first ? getBackendUrl(first) : undefined;
}

export function getOrgImage(org: OrganizationRetrieveSchema): string | undefined {
	const o = org as unknown as { cover_art_social_url?: string };
	const first = o.cover_art_social_url || org.cover_art || org.logo;
	return first ? getBackendUrl(first) : undefined;
}

export function getSeriesImage(series: EventSeriesRetrieveSchema): string | undefined {
	const s = series as unknown as {
		cover_art_social_url?: string;
		organization?: { cover_art_social_url?: string };
	};
	const first =
		s.cover_art_social_url ||
		series.cover_art ||
		s.organization?.cover_art_social_url ||
		series.organization.cover_art ||
		series.logo ||
		series.organization.logo;
	return first ? getBackendUrl(first) : undefined;
}
