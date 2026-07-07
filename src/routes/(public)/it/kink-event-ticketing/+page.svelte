<script lang="ts">
	import { page } from '$app/state';
	import { getLandingPageOrThrow } from '$lib/data/landing-pages';
	import { LandingPageTemplate } from '$lib/components/landing';
	import { SeoHead, buildSeo } from '$lib/seo';
	import { landingExtras } from '$lib/seo/landing';

	const SLUG = 'kink-event-ticketing';
	const content = getLandingPageOrThrow('it', SLUG);

	const seoConfig = $derived(
		buildSeo({
			kind: 'landing',
			url: page.url,
			lang: 'it',
			slug: SLUG,
			title: content.meta.title,
			description: content.meta.description,
			extraJsonLd: landingExtras(content, page.url.origin)
		})
	);
</script>

<SeoHead config={seoConfig} />

<LandingPageTemplate {content} />
