export interface HowToStep {
	name: string;
	text: string;
	url?: string;
}

export interface HowToJsonLd {
	'@context': 'https://schema.org';
	'@type': 'HowTo';
	name: string;
	description?: string;
	step: Array<{
		'@type': 'HowToStep';
		position: number;
		name: string;
		text: string;
		url?: string;
	}>;
}

export function generateHowToJsonLd(input: {
	name: string;
	description?: string;
	steps: HowToStep[];
}): HowToJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'HowTo',
		name: input.name,
		description: input.description,
		step: input.steps.map((s, i) => ({
			'@type': 'HowToStep',
			position: i + 1,
			name: s.name,
			text: s.text,
			url: s.url
		}))
	};
}
