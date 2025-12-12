<script lang="ts">
	import { page } from '$app/state';
	import { getLandingPage } from '$lib/data/landing-pages';
	import { LandingPageTemplate } from '$lib/components/landing';
	import { toJsonLd, generateBreadcrumbStructuredData } from '$lib/utils/seo';

	const content = getLandingPage('it', 'eventbrite-alternative')!;

	// Generate breadcrumb structured data
	let breadcrumbData = $derived(
		generateBreadcrumbStructuredData([
			{ name: 'Home', url: page.url.origin },
			{ name: content.hero.headline, url: `${page.url.origin}/it/eventbrite-alternative` }
		])
	);
	let breadcrumbJsonLd = $derived(toJsonLd(breadcrumbData));

	// Generate FAQ structured data
	let faqStructuredData = $derived({
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: content.faq.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: item.answer
			}
		}))
	});
	let faqJsonLd = $derived(JSON.stringify(faqStructuredData));

	// Generate WebPage structured data
	let webPageStructuredData = $derived({
		'@context': 'https://schema.org',
		'@type': 'WebPage',
		name: content.meta.title,
		description: content.meta.description,
		url: `${page.url.origin}/it/eventbrite-alternative`,
		inLanguage: 'it',
		isPartOf: {
			'@type': 'WebSite',
			name: 'Revel',
			url: page.url.origin
		}
	});
	let webPageJsonLd = $derived(JSON.stringify(webPageStructuredData));
</script>

<svelte:head>
	<title>{content.meta.title}</title>
	<meta name="description" content={content.meta.description} />
	<meta name="keywords" content={content.meta.keywords} />
	<link rel="canonical" href="{page.url.origin}/it/eventbrite-alternative" />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content={content.meta.title} />
	<meta property="og:description" content={content.meta.description} />
	<meta property="og:url" content="{page.url.origin}/it/eventbrite-alternative" />
	<meta property="og:site_name" content="Revel" />
	<meta property="og:locale" content="it_IT" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={content.meta.title} />
	<meta name="twitter:description" content={content.meta.description} />

	<!-- Alternate language versions -->
	<link rel="alternate" hreflang="en" href="{page.url.origin}/eventbrite-alternative" />
	<link rel="alternate" hreflang="de" href="{page.url.origin}/de/eventbrite-alternative" />
	<link rel="alternate" hreflang="it" href="{page.url.origin}/it/eventbrite-alternative" />
	<link rel="alternate" hreflang="x-default" href="{page.url.origin}/eventbrite-alternative" />

	<!-- Structured Data -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html '<script type="application/ld+json">' + breadcrumbJsonLd + '</script>'}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html '<script type="application/ld+json">' + faqJsonLd + '</script>'}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html '<script type="application/ld+json">' + webPageJsonLd + '</script>'}
</svelte:head>

<LandingPageTemplate {content} />
