export interface ListItem {
	name: string;
	url: string;
	image?: string;
}

export interface ItemListJsonLd {
	'@context': 'https://schema.org';
	'@type': 'ItemList';
	name?: string;
	description?: string;
	numberOfItems: number;
	itemListElement: Array<{
		'@type': 'ListItem';
		position: number;
		url: string;
		name: string;
		image?: string;
	}>;
}

export function generateItemListJsonLd(
	items: ListItem[],
	name?: string,
	description?: string
): ItemListJsonLd {
	return {
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name,
		description,
		numberOfItems: items.length,
		itemListElement: items.map((it, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			url: it.url,
			name: it.name,
			image: it.image
		}))
	};
}
