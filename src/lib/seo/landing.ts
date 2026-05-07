import { generateFaqJsonLd, generateSoftwareApplicationJsonLd } from './jsonld';
import type { LandingPageContent } from '$lib/data/landing-pages';

/**
 * Build the extra JSON-LD blocks every landing page emits:
 * - SoftwareApplication (Revel)
 * - FAQPage from the page's faq[]
 */
export function landingExtras(content: LandingPageContent, origin: string): object[] {
	return [
		generateSoftwareApplicationJsonLd({
			name: 'Revel',
			url: origin,
			description: content.meta.description,
			operatingSystem: 'Web'
		}),
		generateFaqJsonLd(content.faq)
	];
}
