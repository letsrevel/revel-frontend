<script lang="ts">
	import { page } from '$app/state';
	import { getLandingPage } from '$lib/data/landing-pages';
	import { LandingPageTemplate } from '$lib/components/landing';
	import { SeoHead, buildSeo } from '$lib/seo';
	import { landingExtras } from '$lib/seo/landing';

	const SLUG = 'self-hosted-event-platform';
	const content = getLandingPage('it', SLUG)!;

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
