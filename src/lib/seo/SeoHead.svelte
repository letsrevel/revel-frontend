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
	{#if config.og.logo}
		<meta property="og:logo" content={config.og.logo} />
	{/if}
	{#if config.og.image}
		<meta property="og:image" content={config.og.image} />
		{#if config.og.imageAlt}
			<meta property="og:image:alt" content={config.og.imageAlt} />
		{/if}
		{#if config.og.imageWidth}
			<meta property="og:image:width" content={String(config.og.imageWidth)} />
		{/if}
		{#if config.og.imageHeight}
			<meta property="og:image:height" content={String(config.og.imageHeight)} />
		{/if}
		{#if config.og.imageType}
			<meta property="og:image:type" content={config.og.imageType} />
		{/if}
	{/if}

	<meta name="twitter:card" content={config.twitter.card} />
	<meta name="twitter:title" content={config.twitter.title} />
	<meta name="twitter:description" content={config.twitter.description} />
	<meta name="twitter:site" content={config.twitter.site} />
	{#if config.twitter.image}
		<meta name="twitter:image" content={config.twitter.image} />
		{#if config.twitter.imageAlt}
			<meta name="twitter:image:alt" content={config.twitter.imageAlt} />
		{/if}
	{/if}

	{#each config.hreflang as alt (alt.lang)}
		<link rel="alternate" hreflang={alt.lang} href={alt.href} />
	{/each}

	{#each config.jsonLd as block, i (i)}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html `<script type="application/ld+json">${toJsonLd(block)}<` + `/script>`}
	{/each}
</svelte:head>
