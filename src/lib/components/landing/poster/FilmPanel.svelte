<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { Play } from '@lucide/svelte';
	import PosterPanel from './PosterPanel.svelte';

	/**
	 * The renders live in the public R2 bucket (no egress fees, no cookies);
	 * this origin is allow-listed in `media-src` (svelte.config.js). Poster
	 * frames and captions are tiny and ship same-origin from static/film/.
	 */
	const FILM_ORIGIN = 'https://public.letsrevel.io';

	// Only EN and DE cuts exist; every other locale gets the EN film and the
	// copy says so (filmEnglishNote).
	const lang = $derived<'en' | 'de'>(getLocale() === 'de' ? 'de' : 'en');
	const src = $derived(`${FILM_ORIGIN}/videos/one-line-${lang.toUpperCase()}-1080p.mp4`);
	const poster = $derived(`/film/one-line-${lang}-poster-v1.webp`);
	const captions = $derived(`/film/one-line-${lang}-v1.vtt`);
	const showEnglishNote = $derived(getLocale() !== 'en' && getLocale() !== 'de');

	let video: HTMLVideoElement | undefined = $state();
	let started = $state(false);

	// Nothing is fetched until this click (`preload="none"`), so the landing
	// page stays free of third-party requests for visitors who never press play.
	function play(): void {
		if (!video) return;
		started = true;
		// Called inside the click handler so the user gesture still counts and
		// the browser allows playback with sound.
		void video.play().catch(() => {
			// Leave the native controls up so the visitor can retry.
		});
		video.focus();
	}
</script>

<!-- Aubergine is the film's own backdrop: the frame dissolves into the panel.
     Text pairs on #26113D: white 17.1:1, lavender kicker 5.6:1. The next panel
     (Pricing) is amber, hence cut-amber. -->
<PosterPanel bgClass="bg-[hsl(var(--poster-aubergine))]" cutToClass="cut-amber">
	<div id="film" class="scroll-mt-24">
		<div
			class="flex flex-col gap-4 text-[hsl(var(--poster-white))] md:flex-row md:items-end md:justify-between md:gap-10"
		>
			<div>
				<p
					class="text-sm font-extrabold uppercase tracking-[0.12em] text-[hsl(var(--poster-lavender))]"
				>
					{m['home.poster.filmLabel']()}
				</p>
				<h2 class="mt-2 text-3xl font-black leading-[1.15] sm:text-4xl">
					{m['home.poster.filmTitle']()}
				</h2>
			</div>
			<div class="max-w-sm leading-relaxed md:pb-1">
				<p>{m['home.poster.filmBody']()}</p>
				{#if showEnglishNote}
					<p class="mt-2 text-sm">{m['home.poster.filmEnglishNote']()}</p>
				{/if}
			</div>
		</div>

		<!-- At rest the frame leans like a poster sticker; pressing play
		     straightens it so the film itself is never watched askew. -->
		<div
			class="film-frame relative mt-8 aspect-video overflow-hidden rounded-[1.25rem] bg-[hsl(var(--poster-aubergine))] shadow-[0_24px_60px_hsl(0_0%_0%/0.45)] ring-1 ring-inset ring-[hsl(var(--poster-white)/0.12)]"
			class:started
		>
			<video
				bind:this={video}
				class="h-full w-full"
				{src}
				{poster}
				preload="none"
				playsinline
				controls={started}
				aria-label={m['home.poster.filmVideoLabel']()}
			>
				<track
					kind="captions"
					src={captions}
					srclang={lang}
					label={lang === 'de' ? 'Deutsch' : 'English'}
				/>
			</video>

			{#if !started}
				<button
					type="button"
					onclick={play}
					aria-label={m['home.poster.filmPlayAria']()}
					class="group absolute inset-0 flex items-end justify-start p-2.5 focus-visible:outline-none sm:p-6"
				>
					<span
						class="flex items-center gap-2 rounded-full bg-[hsl(var(--poster-white))] py-1.5 pl-1.5 pr-3.5 text-sm font-bold text-[hsl(var(--poster-ink))] shadow-[0_8px_24px_hsl(0_0%_0%/0.35)] transition-transform group-hover:scale-[1.03] group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-white motion-reduce:transition-none sm:gap-3 sm:py-2 sm:pl-2 sm:pr-5 sm:pr-6 sm:text-base"
					>
						<span
							class="grid size-9 place-items-center rounded-full bg-[linear-gradient(135deg,var(--logo-from),var(--logo-to))] sm:size-14"
							aria-hidden="true"
						>
							<Play class="size-4 translate-x-px fill-current text-white sm:size-6" />
						</span>
						<!-- Below sm the label would cover the poster's headline; the
						     button's aria-label still names it. -->
						<span class="hidden sm:inline">{m['home.poster.filmPlay']()}</span>
						<span class="tabular-nums" aria-hidden="true">1:35</span>
					</span>
				</button>
			{/if}
		</div>
	</div>
</PosterPanel>

<style>
	.film-frame {
		transform: rotate(-1.25deg);
		transition: transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.film-frame.started {
		transform: none;
	}
	@media (prefers-reduced-motion: reduce) {
		.film-frame {
			transition: none;
		}
	}
</style>
