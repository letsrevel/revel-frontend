<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import RevelMark from '$lib/components/brand/RevelMark.svelte';
	import PosterPanel from './PosterPanel.svelte';
	import PosterSticker from './PosterSticker.svelte';
	import RotatingNoun from './RotatingNoun.svelte';

	interface Props {
		isAuthenticated: boolean;
	}
	const { isAuthenticated }: Props = $props();

	/**
	 * Inclusive rotating-vowel kicker for gendered-adjective locales,
	 * migrated verbatim from the retired LandingHero (see #505). The
	 * inclusive marker is FIRST so SSR/no-JS renders the inclusive form.
	 */
	const INCLUSIVE_KICKER: Record<string, { stem: string; endings: readonly string[] }> = {
		it: { stem: 'Benvenut', endings: ['ə', 'a', 'o'] },
		es: { stem: 'Bienvenid', endings: ['e', 'a', 'o'] },
		pt: { stem: 'Bem-vind', endings: ['e', 'a', 'o'] }
	};
	const kicker = $derived(INCLUSIVE_KICKER[getLocale()]);

	const nouns = $derived([
		m['home.poster.heroNoun1'](),
		m['home.poster.heroNoun2'](),
		m['home.poster.heroNoun3']()
	]);
</script>

<PosterPanel
	bgClass="bg-[linear-gradient(160deg,hsl(var(--poster-crimson-deep))_0%,hsl(var(--poster-purple))_75%)]"
	cutToClass="cut-amber"
>
	<div
		class="pointer-events-none absolute right-6 top-8 hidden rotate-[9deg] md:block"
		aria-hidden="true"
	>
		<div
			class="relative rounded-[22px] bg-[hsl(var(--poster-white))] p-2.5 shadow-[0_6px_16px_hsl(var(--poster-ink)/0.3)]"
		>
			<RevelMark decorative class="h-16 w-auto" />
			<span class="absolute -left-4 -top-3 text-2xl">❤️</span>
			<span class="absolute -bottom-2 -right-3 text-base">❤️</span>
		</div>
	</div>

	<div class="max-w-3xl">
		{#if kicker}
			<!-- `perspective` must live on an ANCESTOR of the flipping element:
			     RotatingNoun's rotateX renders flat without it. -->
			<p
				class="mb-2 text-2xl font-bold text-[hsl(var(--poster-white))] [perspective:800px]"
				aria-hidden="true"
			>
				{kicker.stem}<RotatingNoun items={[...kicker.endings]} />
			</p>
		{/if}
		<h1
			class="text-4xl font-black leading-[1.12] tracking-tight text-[hsl(var(--poster-white))] sm:text-6xl"
		>
			<span class="sr-only">{m['home.poster.heroAria']()}</span>
			<span aria-hidden="true">
				{m['home.poster.heroBefore']()}
				<PosterSticker tint="purple" rotate={-2.5} class="text-[0.95em] [perspective:800px]">
					<RotatingNoun items={nouns} />
				</PosterSticker>
				<br />
				{m['home.poster.heroAfter']()}
			</span>
		</h1>
		<!-- Full-opacity white: at text-lg/medium a 0.92 alpha drops the pair
		     below the 4.5:1 AA threshold for non-large text. -->
		<p class="mt-6 max-w-xl text-lg font-medium text-[hsl(var(--poster-white))] sm:text-xl">
			{m['home.poster.heroSubline']()}
		</p>
		<div class="mt-8 flex flex-wrap items-center gap-3.5">
			{#if isAuthenticated}
				<a
					href={resolve('/(auth)/dashboard', {})}
					class="rounded-full bg-[hsl(var(--poster-ink))] px-7 py-3.5 font-bold text-[hsl(var(--poster-white))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
				>
					{m['userMenu.dashboard']()}
				</a>
				<a
					href={resolve('/(public)/events', {})}
					class="rounded-full border-2 border-[hsl(var(--poster-white))] bg-[hsl(var(--poster-white)/0.16)] px-6 py-3 font-bold text-[hsl(var(--poster-white))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
				>
					{m['nav.browseEvents']()}
				</a>
			{:else}
				<a
					href={resolve('/(public)/register', {})}
					class="rounded-full bg-[hsl(var(--poster-ink))] px-7 py-3.5 font-bold text-[hsl(var(--poster-white))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
				>
					{m['home.poster.heroStartOrganizing']()}
				</a>
				<a
					href="https://demo.letsrevel.io/login"
					target="_blank"
					rel="noopener noreferrer"
					class="rounded-full border-2 border-[hsl(var(--poster-white))] bg-[hsl(var(--poster-white)/0.16)] px-6 py-3 font-bold text-[hsl(var(--poster-white))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
				>
					{m['home.poster.heroPeekDemo']()}
				</a>
			{/if}
		</div>
		{#if !isAuthenticated}
			<div class="mt-4">
				<!-- Full opacity: small text on the gradient needs the whole 4.5:1. -->
				<a
					href={resolve('/(public)/login', {})}
					class="text-sm text-[hsl(var(--poster-white))] underline-offset-2 hover:underline"
				>
					{m['home.alreadyHaveAccount']()}
				</a>
			</div>
		{/if}
	</div>
</PosterPanel>
