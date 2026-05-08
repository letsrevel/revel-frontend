<script lang="ts">
	import type { SeoConfig } from './types';
	import { toJsonLd } from './jsonld/escape';

	interface Props {
		config: SeoConfig;
	}
	const { config }: Props = $props();
</script>

<svelte:head>
	<title>{config.title}</title>
	<meta name="description" content={config.description} />
	<link rel="canonical" href={config.canonical} />
	{#if config.robots}
		<meta name="robots" content={config.robots} />
	{/if}

	<meta property="og:type" content={config.og.type} />
	<meta property="og:title" content={config.og.title} />
	<meta property="og:description" content={config.og.description} />
	<meta property="og:url" content={config.og.url} />
	<meta property="og:site_name" content={config.og.siteName} />
	<meta property="og:locale" content={config.og.locale} />
	{#each config.og.localeAlternate as alt (alt)}
		<meta property="og:locale:alternate" content={alt} />
	{/each}
	{#if config.og.image}
		<meta property="og:image" content={config.og.image} />
	{/if}

	<meta name="twitter:card" content={config.twitter.card} />
	<meta name="twitter:title" content={config.twitter.title} />
	<meta name="twitter:description" content={config.twitter.description} />
	<meta name="twitter:site" content={config.twitter.site} />
	{#if config.twitter.image}
		<meta name="twitter:image" content={config.twitter.image} />
	{/if}

	{#each config.hreflang as alt (alt.lang)}
		<link rel="alternate" hreflang={alt.lang} href={alt.href} />
	{/each}

	{#each config.jsonLd as block, i (i)}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html `<script type="application/ld+json">${toJsonLd(block)}<` + `/script>`}
	{/each}
</svelte:head>
