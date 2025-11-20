<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';
	import { formatEventDateRange } from '$lib/utils/date';
	import { getEventFallbackGradient, getEventCoverArt, getEventLogo } from '$lib/utils/event';
	import { getBackendUrl } from '$lib/config/api';
	import { getImageUrl } from '$lib/utils/url';
	import { downloadRevelEventICalFile } from '$lib/utils/ical';
	import { MapPin, Calendar, Share2 } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		event: EventDetailSchema;
		class?: string;
	}

	let { event, class: className }: Props = $props();

	// Cover art with fallback hierarchy: event -> series -> organization
	let coverArtPath = $derived(getEventCoverArt(event));
	let coverImageUrl = $derived(getImageUrl(coverArtPath));

	// Logo with fallback hierarchy: event -> series -> organization
	let logoPath = $derived(getEventLogo(event));
	let logoUrl = $derived(getImageUrl(logoPath));

	// Compute location display
	let locationDisplay = $derived.by(() => {
		if (!event.city) return event.address || m['eventHeader.locationTbd']();
		const cityCountry = event.city.country
			? `${event.city.name}, ${event.city.country}`
			: event.city.name;
		return event.address ? `${event.address}, ${cityCountry}` : cityCountry;
	});

	// Date range display
	let dateRange = $derived(formatEventDateRange(event.start, event.end));

	// Fallback gradient if no cover art
	let fallbackGradient = $derived(getEventFallbackGradient(event.id));

	// Copy event link to clipboard
	async function handleShare(): Promise<void> {
		try {
			await navigator.clipboard.writeText(window.location.href);
			// TODO: Show toast notification "Link copied!"
		} catch (err) {
			console.error('Failed to copy link:', err);
		}
	}

	// Download iCal file for this event
	function handleDownloadCalendar(): void {
		downloadRevelEventICalFile(event);
	}
</script>

<header class={cn('relative w-full overflow-hidden', className)}>
	<!-- Cover Image or Gradient -->
	<div class="relative mx-auto h-64 w-full max-w-[1920px] md:h-96">
		{#if coverImageUrl}
			<img
				src={coverImageUrl}
				alt="{event.name} cover image"
				class="h-full w-full object-cover object-center"
				loading="eager"
			/>
			<!-- Gradient overlay for text contrast -->
			<div
				class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
			></div>
		{:else}
			<!-- Fallback gradient -->
			<div class="h-full w-full {fallbackGradient}"></div>
			<div class="absolute inset-0 bg-gradient-to-br from-black/20 to-black/40"></div>
		{/if}

		<!-- Header Content Overlay -->
		<div class="absolute inset-0 flex flex-col justify-end p-6 pb-12 md:p-8">
			<div class="max-w-4xl">
				<!-- Event Name -->
				<h1 class="mb-3 text-3xl font-bold text-white md:text-4xl lg:text-5xl">
					{event.name}
				</h1>

				<!-- Metadata Row -->
				<div class="flex flex-col gap-2 text-sm text-white/90 md:text-base">
					<!-- Date (clickable to download iCal) -->
					<button
						type="button"
						onclick={handleDownloadCalendar}
						class="group flex items-center gap-2 transition-all hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50"
						title="Download calendar event"
						aria-label="Download calendar event for {event.name}"
					>
						<Calendar class="h-5 w-5 shrink-0" aria-hidden="true" />
						<time datetime={event.start} class="group-hover:underline">{dateRange}</time>
					</button>

					<!-- Location -->
					<div class="flex items-center gap-2">
						<MapPin class="h-5 w-5 shrink-0" aria-hidden="true" />
						<span>{locationDisplay}</span>
					</div>
				</div>
			</div>

			<!-- Share Button (Desktop) -->
			<button
				type="button"
				onclick={handleShare}
				class="absolute right-6 top-6 hidden rounded-full bg-white/20 p-3 backdrop-blur-sm transition-all hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 md:block"
				aria-label="Share event"
			>
				<Share2 class="h-5 w-5 text-white" aria-hidden="true" />
			</button>
		</div>
	</div>

	<!-- Organization Badge (Overlaps cover image) -->
	<!-- Note: Always shows organization logo/initial for clarity, not the event logo fallback -->
	<div class="relative mx-auto max-w-[1920px] px-6 md:px-8">
		<a
			href="/org/{event.organization.slug}"
			class="group -mt-8 inline-flex items-center gap-3 rounded-lg bg-background p-3 shadow-lg ring-1 ring-border transition-all hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			{#if event.organization.logo}
				<img
					src={getImageUrl(event.organization.logo) || ''}
					alt="{event.organization.name} logo"
					class="h-12 w-12 rounded-md object-cover"
				/>
			{:else}
				<div
					class="flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-lg font-bold text-primary-foreground"
				>
					{event.organization.name.charAt(0).toUpperCase()}
				</div>
			{/if}

			<div class="flex flex-col">
				<span class="text-xs text-muted-foreground">{m['eventHeader.organizedBy']()}</span>
				<span class="font-semibold text-foreground group-hover:text-primary">
					{event.organization.name}
				</span>
			</div>
		</a>
	</div>
</header>
