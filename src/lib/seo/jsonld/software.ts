export interface SoftwareApplicationJsonLd {
	'@context': 'https://schema.org';
	'@type': 'SoftwareApplication';
	name: string;
	url: string;
	description?: string;
	applicationCategory: 'EventManagementApplication';
	operatingSystem: string;
	offers: {
		'@type': 'Offer';
		price: '0';
		priceCurrency: 'USD';
	};
}

export function generateSoftwareApplicationJsonLd(input: {
	name: string;
	url: string;
	description?: string;
	operatingSystem: string;
}): SoftwareApplicationJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: input.name,
		url: input.url,
		description: input.description,
		applicationCategory: 'EventManagementApplication',
		operatingSystem: input.operatingSystem,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
	};
}
