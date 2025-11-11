<script lang="ts">
	import { page } from '$app/state';
	import { generateHomeMeta } from '$lib/utils/seo';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// Generate comprehensive meta tags for home page
	let metaTags = $derived(generateHomeMeta(page.url.origin));

	// Animated letter for Italian welcome (client-side only)
	const letters = ['a', 'o', 'ə'] as const;
	let currentLetterIndex = $state(0);
	let currentLetter = $derived(letters[currentLetterIndex]);
	let rotation = $state(0);
	let isItalian = $derived(browser && getLocale() === 'it');

	onMount(() => {
		if (getLocale() === 'it') {
			const interval = setInterval(() => {
				// Always rotate forward by 180° (never backwards)
				rotation += 180;

				// At 90° (halfway point = 300ms), swap to the next letter
				setTimeout(() => {
					currentLetterIndex = (currentLetterIndex + 1) % letters.length;
				}, 300);
			}, 2000);

			return () => clearInterval(interval);
		}
		// No cleanup needed for non-Italian locale
		return undefined;
	});
</script>

<svelte:head>
	<title>{metaTags.title}</title>
	<meta name="description" content={metaTags.description} />
	{#if metaTags.canonical}
		<link rel="canonical" href={metaTags.canonical} />
	{/if}

	<!-- Open Graph -->
	<meta property="og:type" content={metaTags.ogType || 'website'} />
	<meta property="og:title" content={metaTags.ogTitle || metaTags.title} />
	<meta property="og:description" content={metaTags.ogDescription || metaTags.description} />
	<meta property="og:url" content={metaTags.ogUrl || page.url.href} />
	<meta property="og:site_name" content="Revel" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content={metaTags.twitterCard || 'summary_large_image'} />
	<meta name="twitter:title" content={metaTags.twitterTitle || metaTags.title} />
	<meta name="twitter:description" content={metaTags.twitterDescription || metaTags.description} />

	<!-- Additional SEO meta tags -->
	<meta name="robots" content="index, follow" />
	<meta name="keywords" content={m['home.keywords']()} />
</svelte:head>

<div class="container mx-auto px-4 py-16">
	<div class="flex flex-col items-center justify-center text-center">
		<h1 class="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
			{#if isItalian}
				<!-- Italian with animated letter flip -->
				Benvenut<span class="flip-container">
					<span class="flip-letter" style="transform: rotateY({rotation}deg)">
						{currentLetter}
					</span>
				</span>
				su <span class="text-primary">Revel</span>
			{:else}
				<!-- Other languages using i18n -->
				{@html m['home.welcomeToRevel']({
					flipContainer: '',
					revel: `<span class="text-primary">Revel</span>`
				})}
			{/if}
		</h1>
		<p class="mt-6 max-w-2xl text-lg text-muted-foreground">
			{m['home.tagline']()}
		</p>
		<div class="mt-10 flex items-center gap-4">
			<a
				href="/events"
				class="rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				{m['nav.browseEvents']()}
			</a>
			<a
				href="/register"
				class="rounded-md border border-primary px-6 py-3 text-base font-semibold text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
			>
				{m['home.getStarted']()}
			</a>
		</div>
	</div>

	<!-- Features Section -->
	<div class="mt-24 grid gap-8 md:grid-cols-3">
		<div class="rounded-lg border bg-card p-6 text-center">
			<div class="mb-4 flex justify-center">
				<div class="rounded-full bg-primary/10 p-3">
					<svg
						class="h-6 w-6 text-primary"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
						/>
					</svg>
				</div>
			</div>
			<h3 class="mb-2 text-lg font-semibold">{m['home.discoverEventsTitle']()}</h3>
			<p class="text-sm text-muted-foreground">
				{m['home.discoverEventsDescription']()}
			</p>
		</div>

		<div class="rounded-lg border bg-card p-6 text-center">
			<div class="mb-4 flex justify-center">
				<div class="rounded-full bg-secondary/10 p-3">
					<svg
						class="h-6 w-6 text-secondary"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
						/>
					</svg>
				</div>
			</div>
			<h3 class="mb-2 text-lg font-semibold">{m['home.buildCommunityTitle']()}</h3>
			<p class="text-sm text-muted-foreground">
				{m['home.buildCommunityDescription']()}
			</p>
		</div>

		<div class="rounded-lg border bg-card p-6 text-center">
			<div class="mb-4 flex justify-center">
				<div class="rounded-full bg-accent/10 p-3">
					<svg
						class="h-6 w-6 text-accent"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
						/>
					</svg>
				</div>
			</div>
			<h3 class="mb-2 text-lg font-semibold">{m['home.safeSecureTitle']()}</h3>
			<p class="text-sm text-muted-foreground">
				{m['home.safeSecureDescription']()}
			</p>
		</div>
	</div>
</div>

<style>
	.flip-container {
		perspective: 1000px;
		display: inline-block;
	}

	.flip-letter {
		display: inline-block;
		transition: transform 0.6s ease-in-out;
		transform-style: preserve-3d;
	}
</style>
