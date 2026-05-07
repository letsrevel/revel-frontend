export interface FaqQA {
	question: string;
	answer: string;
}

export interface FaqJsonLd {
	'@context': 'https://schema.org';
	'@type': 'FAQPage';
	mainEntity: Array<{
		'@type': 'Question';
		name: string;
		acceptedAnswer: { '@type': 'Answer'; text: string };
	}>;
}

export function generateFaqJsonLd(items: FaqQA[]): FaqJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: items.map((q) => ({
			'@type': 'Question',
			name: q.question,
			acceptedAnswer: { '@type': 'Answer', text: q.answer }
		}))
	};
}
