<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import PosterPanel from './PosterPanel.svelte';

	interface Props {
		/**
		 * Locale-prefixed landing-path prefix (empty for `en`, `/de` or `/it` otherwise).
		 * Landing pages are NOT paraglide-translated; they use `/de/` and `/it/` prefixes.
		 */
		landingPagePrefix: string;
	}
	const { landingPagePrefix }: Props = $props();

	const stubs = $derived([
		{
			emoji: '🎟️',
			border: 'border-[hsl(var(--poster-lavender))]',
			tilt: '-rotate-1',
			title: m['home.poster.feat1Title'](),
			body: m['home.poster.feat1Body']()
		},
		{
			emoji: '📋',
			border: 'border-[hsl(var(--poster-crimson-deep))]',
			tilt: 'rotate-1',
			title: m['home.poster.feat2Title'](),
			body: m['home.poster.feat2Body']()
		},
		{
			emoji: '🥘',
			border: 'border-[hsl(var(--poster-amber))]',
			tilt: '-rotate-[0.5deg]',
			title: m['home.poster.feat3Title'](),
			body: m['home.poster.feat3Body']()
		},
		{
			emoji: '🕶️',
			border: 'border-[hsl(var(--poster-periwinkle))]',
			tilt: 'rotate-[0.9deg]',
			title: m['home.poster.feat4Title'](),
			body: m['home.poster.feat4Body']()
		}
	]);

	const useCases = $derived([
		{ path: '/queer-event-management', label: m['footer.solutionQueer']() },
		{ path: '/kink-event-ticketing', label: m['footer.solutionKink']() },
		{ path: '/privacy-focused-events', label: m['footer.solutionPrivacy']() },
		{ path: '/self-hosted-event-platform', label: m['footer.solutionSelfHosted']() },
		{ path: '/eventbrite-alternative', label: m['footer.solutionEventbrite']() },
		{ path: '/community-first-event-platform', label: m['footer.solutionCommunity']() }
	]);
</script>

<PosterPanel bgClass="bg-[hsl(var(--poster-paper))]" cutToClass="cut-ink" cutDirection="left">
	<div class="text-[hsl(var(--poster-ink))]">
		<!-- Small uppercase labels stay FULL-opacity ink: softening 12px text on a light
			 panel is where this poster keeps failing AA, so hierarchy comes from weight
			 and tracking instead. Same rule applies to the use-cases label below. -->
		<p class="text-sm font-extrabold uppercase tracking-[0.12em]">
			{m['home.poster.featuresLabel']()}
		</p>
		<h2 class="mt-2 text-3xl font-black sm:text-4xl">{m['home.poster.featuresH1']()}</h2>
		<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each stubs as stub (stub.title)}
				<!-- `p-[18px]`: Tailwind's default spacing scale has no 4.5 step here. -->
				<div
					class="rounded-2xl border-2 border-dashed bg-[hsl(var(--poster-white))] p-[18px] {stub.border} {stub.tilt}"
				>
					<p class="text-2xl" aria-hidden="true">{stub.emoji}</p>
					<p class="mt-1.5 font-extrabold">{stub.title}</p>
					<!-- ink@72% composited over the WHITE stub card = 6.8:1 — hand-verified,
						 over the 4.5 AA floor for this 14px body. Note the surface: the same
						 alpha over the lavender paper panel would be tighter. -->
					<p class="mt-1 text-sm text-[hsl(var(--poster-ink)/0.72)]">{stub.body}</p>
				</div>
			{/each}
		</div>
		<p class="mt-8 text-sm font-extrabold uppercase tracking-[0.12em]">
			{m['home.poster.useCasesLabel']()}
		</p>
		<ul class="mt-3 flex flex-wrap gap-2">
			{#each useCases as uc (uc.path)}
				<li>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- locale-prefixed landing path; the prefix comes from getLocale() and cannot map to a single static route id -->
					<a
						href="{landingPagePrefix}{uc.path}"
						class="inline-block rounded-full border-2 border-[hsl(var(--poster-ink)/0.25)] px-3.5 py-1.5 text-sm font-bold hover:border-[hsl(var(--poster-purple))] hover:text-[hsl(var(--poster-purple))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--poster-purple))]"
					>
						{uc.label}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	</div>
</PosterPanel>
