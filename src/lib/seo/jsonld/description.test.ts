import { describe, it, expect } from 'vitest';
import { generateSeriesJsonLd } from './series';
import { generateOrganizationJsonLd } from './organization';
import type {
	EventSeriesRetrieveSchema,
	OrganizationRetrieveSchema
} from '$lib/api/generated/types.gen';

// Series and organization descriptions are markdown, not HTML: the structured
// data must carry the plain text, without heading or emphasis markers.
const MARKDOWN = '# Seasonal Gatherings\n\nCelebrating **the seasons** together';
const PLAIN = 'Seasonal Gatherings Celebrating the seasons together';

describe('JSON-LD descriptions strip markdown', () => {
	it('series', () => {
		const ld = generateSeriesJsonLd(
			{
				name: 'Seasonal',
				description: MARKDOWN,
				organization: { name: 'Org' }
			} as unknown as EventSeriesRetrieveSchema,
			'https://example.test/series'
		);
		expect(ld.description).toBe(PLAIN);
	});

	it('organization', () => {
		const ld = generateOrganizationJsonLd(
			{ name: 'Org', description: MARKDOWN } as unknown as OrganizationRetrieveSchema,
			'https://example.test/org'
		);
		expect(ld.description).toBe(PLAIN);
	});
});
