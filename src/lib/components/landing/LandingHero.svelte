<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	interface Props {
		isAuthenticated: boolean;
	}
	const { isAuthenticated }: Props = $props();

	/**
	 * Languages that inflect the welcome adjective for gender get an animated
	 * ending instead of one chosen form: the greeting flips through feminine,
	 * masculine, and the marker that language's inclusive writing actually uses
	 * (Italian schwa, Spanish/Portuguese -e).
	 *
	 * `fallback` is what SSR and no-JS render — a plural greeting sharing the same
	 * stem, so hydration only ever swaps the final letter rather than reflowing
	 * the headline. It lives here rather than in the catalogs because it must stay
	 * in lockstep with `stem`.
	 */
	const INCLUSIVE_WELCOME: Record<
		string,
		{ stem: string; endings: readonly string[]; connector: string }
	> = {
		it: { stem: 'Benvenut', endings: ['a', 'o', 'ə'], connector: 'su' },
		es: { stem: 'Bienvenid', endings: ['a', 'o', 'e'], connector: 'a' },
		pt: { stem: 'Bem-vind', endings: ['a', 'o', 'e'], connector: 'ao' }
	};

	// Client-side only: SSR renders the plain i18n headline, so the markup does not
	// depend on a locale the server resolved differently (#505).
	const inclusive = $derived(browser ? INCLUSIVE_WELCOME[getLocale()] : undefined);
	let currentLetterIndex = $state(0);
	const currentLetter = $derived(inclusive?.endings[currentLetterIndex] ?? '');
	let rotation = $state(0);

	onMount(() => {
		const config = INCLUSIVE_WELCOME[getLocale()];
		if (!config) return undefined;

		let swapTimeout: ReturnType<typeof setTimeout> | undefined;
		const interval = setInterval(() => {
			// Always rotate forward by 180° (never backwards)
			rotation += 180;

			// At 90° (halfway point = 300ms), swap to the next letter
			swapTimeout = setTimeout(() => {
				currentLetterIndex = (currentLetterIndex + 1) % config.endings.length;
			}, 300);
		}, 2000);

		return () => {
			clearInterval(interval);
			clearTimeout(swapTimeout);
		};
	});
</script>

<div class="hero-warm-glow">
	<div class="container mx-auto px-4 py-16">
		<div class="flex flex-col items-center justify-center text-center">
			<h1 class="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
				{#if inclusive}
					<!-- Gendered welcome adjective, rendered with an animated inclusive ending -->
					{inclusive.stem}<span class="flip-container">
						<span class="flip-letter" style="transform: rotateY({rotation}deg)">
							{currentLetter}
						</span>
					</span>
					{inclusive.connector} <span class="revel-shine">Revel</span>
				{:else}
					<!-- Other languages using i18n.
					     Rendered as real markup (not {@html}) so it re-renders on
					     hydration and follows the active locale. See #505. -->
					{m['home.welcomeTo']()} <span class="revel-shine">Revel</span>
				{/if}
			</h1>
			<p
				class="mt-8 flex flex-wrap items-center justify-center gap-3 text-2xl font-semibold tracking-wide text-foreground/90 sm:gap-5 sm:text-3xl md:text-4xl"
			>
				<span class="warm-keyword">{m['home.keywordFree']()}</span>
				<span class="text-foreground/30" aria-hidden="true">&middot;</span>
				<span class="warm-keyword">{m['home.keywordOpen']()}</span>
				<span class="text-foreground/30" aria-hidden="true">&middot;</span>
				<span class="warm-keyword">{m['home.keywordSafe']()}</span>
			</p>
			<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
				{#if isAuthenticated}
					<a
						href={resolve('/(auth)/dashboard', {})}
						class="rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						{m['userMenu.dashboard']()}
					</a>
					<a
						href={resolve('/(public)/events', {})}
						class="rounded-md border border-primary px-6 py-3 text-base font-semibold text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						{m['nav.browseEvents']()}
					</a>
				{:else}
					<a
						href={resolve('/(public)/events', {})}
						class="rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						{m['nav.browseEvents']()}
					</a>
					<a
						href={resolve('/(public)/register', {})}
						class="rounded-md border border-primary px-6 py-3 text-base font-semibold text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						{m['home.getStarted']()}
					</a>
				{/if}
			</div>
			{#if !isAuthenticated}
				<div class="mt-4">
					<a
						href={resolve('/(public)/login', {})}
						class="text-sm text-muted-foreground hover:text-foreground hover:underline"
					>
						{m['home.alreadyHaveAccount']()}
					</a>
				</div>
			{/if}
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

	.hero-warm-glow {
		position: relative;
		overflow: hidden;
	}

	.hero-warm-glow::before {
		content: '';
		position: absolute;
		top: -40%;
		left: 50%;
		transform: translateX(-50%);
		width: 80%;
		height: 100%;
		background: radial-gradient(
			ellipse at center,
			hsl(30 80% 55% / 0.06) 0%,
			hsl(350 70% 55% / 0.03) 40%,
			transparent 70%
		);
		pointer-events: none;
		z-index: 0;
	}

	.hero-warm-glow > :global(*) {
		position: relative;
		z-index: 1;
	}

	.warm-keyword {
		color: hsl(30 80% 65%);
		/*
		 * These sit in a flex row, so each is a blockified flex item whose box is
		 * exactly one line-height tall. Tailwind's display sizes are tighter than
		 * the font's ascent+descent (text-4xl is 2.25rem text in a 2.5rem line), and
		 * `background-clip: text` paints only inside that box — so a descender falls
		 * outside it, gets no paint, and disappears under the transparent text fill.
		 * Latent until `es`/`pt` shipped the first keyword with one ("Seguro").
		 * Symmetric so the row stays vertically centred against the separators.
		 */
		line-height: 1.4;
	}

	@supports ((-webkit-background-clip: text) or (background-clip: text)) {
		.warm-keyword {
			background: linear-gradient(135deg, hsl(30 80% 70%) 0%, hsl(350 65% 65%) 100%);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
		}
	}

	:global(.revel-shine) {
		display: inline-block;
		color: hsl(var(--primary));
	}

	@supports ((-webkit-background-clip: text) or (background-clip: text)) {
		:global(.revel-shine) {
			background: linear-gradient(
				105deg,
				hsl(var(--primary)) 0%,
				hsl(var(--primary)) 40%,
				hsl(30 80% 70%) 48%,
				hsl(350 65% 70%) 52%,
				hsl(var(--primary)) 60%,
				hsl(var(--primary)) 100%
			);
			background-size: 400% 100%;
			background-position: 100% 0;
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
			animation: shine-glare 7.5s ease-in-out infinite;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.revel-shine) {
			animation: none;
		}
	}

	@keyframes shine-glare {
		0%,
		67% {
			background-position: 100% 0;
		}
		100% {
			background-position: 0% 0;
		}
	}
</style>
