import type { EventSeriesRetrieveSchema } from '$lib/api/generated/types.gen';
import { getBackendUrl } from '$lib/config/api';
import { stripMarkup } from '../text';

export interface SeriesJsonLd {
	'@context': 'https://schema.org';
	'@type': 'EventSeries';
	name: string;
	description?: string;
	url: string;
	organizer: { '@type': 'Organization'; name: string };
	image?: string[];
}

export function generateSeriesJsonLd(
	series: EventSeriesRetrieveSchema,
	seriesUrl: string
): SeriesJsonLd {
	const ld: SeriesJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'EventSeries',
		name: series.name,
		description: stripMarkup(series.description) || undefined,
		url: seriesUrl,
		organizer: { '@type': 'Organization', name: series.organization.name }
	};
	const images = [
		series.logo,
		series.cover_art,
		series.organization.logo,
		series.organization.cover_art
	]
		.filter((img): img is string => img != null)
		.map((img) => getBackendUrl(img));
	if (images.length > 0) ld.image = images;
	return ld;
}
