import { describe, it, expect } from 'vitest';
import { generateFaqJsonLd } from '$lib/seo/jsonld/faq';
import { generateHowToJsonLd } from '$lib/seo/jsonld/howto';
import { generateSoftwareApplicationJsonLd } from '$lib/seo/jsonld/software';

describe('FAQPage jsonld', () => {
	it('emits each Q/A as a Question with Answer', () => {
		const ld = generateFaqJsonLd([
			{ question: 'Why?', answer: 'Because.' },
			{ question: 'How?', answer: 'Like this.' }
		]);
		expect(ld['@type']).toBe('FAQPage');
		expect(ld.mainEntity).toHaveLength(2);
		expect(ld.mainEntity[0]).toMatchObject({
			'@type': 'Question',
			name: 'Why?',
			acceptedAnswer: { '@type': 'Answer', text: 'Because.' }
		});
	});
});

describe('HowTo jsonld', () => {
	it('emits HowTo with named steps', () => {
		const ld = generateHowToJsonLd({
			name: 'Self-host Revel',
			description: 'Run Revel on your own infra',
			steps: [
				{ name: 'Clone the repo', text: 'git clone …' },
				{ name: 'docker compose up', text: 'docker compose up -d' }
			]
		});
		expect(ld['@type']).toBe('HowTo');
		expect(ld.name).toBe('Self-host Revel');
		expect(ld.step).toHaveLength(2);
		expect(ld.step[0]).toMatchObject({ '@type': 'HowToStep', position: 1 });
	});
});

describe('SoftwareApplication jsonld', () => {
	it('emits a free-tier offer and required category', () => {
		const ld = generateSoftwareApplicationJsonLd({
			name: 'Revel',
			url: 'https://letsrevel.io',
			description: 'Open-source event platform',
			operatingSystem: 'Web'
		});
		expect(ld['@type']).toBe('SoftwareApplication');
		expect(ld.applicationCategory).toBe('EventManagementApplication');
		expect(ld.offers?.price).toBe('0');
	});
});
