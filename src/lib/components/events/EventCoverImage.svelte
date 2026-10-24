<script lang="ts">
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import {
		getEventCoverArt,
		getEventCoverArtSocial,
		getEventFallbackGradient,
		getEventLogo,
		getEventLogoThumbnail
	} from '$lib/utils/event';
	import { getImageUrl } from '$lib/utils/url';
	import { Calendar } from '@lucide/svelte';
	import EventBadges from './EventBadges.svelte';
	import type { UserEventStatus } from './types';

	interface Props {
		event: EventInListSchema;
		userStatus?: UserEventStatus | null;
		showBadges?: boolean;
		/**
		 * Past-event treatment: desaturates and dims the artwork only. The badge
		 * overlay sits outside the filtered layer, so its text keeps full contrast
		 * (#1094: fading the whole card pulled "Past Event" below 4.5:1).
		 */
		faded?: boolean;
		class?: string;
	}

	const {
		event,
		userStatus = null,
		showBadges = true,
		faded = false,
		class: className
	}: Props = $props();

	// Image state
	let imageError = $state(false);

	// Computed values - prefer social preview for card display (1200x630, matches aspect-video ratio)
	const coverArtSocialPath = $derived(getEventCoverArtSocial(event));
	const coverArtPath = $derived(getEventCoverArt(event));
	const coverArtUrl = $derived(
		!imageError ? getImageUrl(coverArtSocialPath || coverArtPath) : null
	);
	const logoThumbnailPath = $derived(getEventLogoThumbnail(event));
	const logoPath = $derived(getEventLogo(event));
	const logoUrl = $derived(getImageUrl(logoThumbnailPath || logoPath));
	const fallbackGradient = $derived(getEventFallbackGradient(event.id));

	function handleImageError(): void {
		imageError = true;
	}
</script>

<div class={cn('relative aspect-video overflow-hidden', className)}>
	<div class={cn('h-full w-full', faded && 'opacity-75 grayscale')} data-testid="event-cover-art">
		{#if coverArtUrl}
			<img
				src={coverArtUrl}
				alt={event.name}
				class="h-full w-full object-cover"
				loading="lazy"
				onerror={handleImageError}
			/>
		{:else}
			<!-- Fallback gradient with logo -->
			<div class={cn('h-full w-full bg-gradient-to-br', fallbackGradient)}>
				{#if logoUrl}
					<div class="flex h-full w-full items-center justify-center p-4">
						<div
							class="aspect-square w-full max-w-[60%] overflow-hidden rounded-lg bg-poster-white/10 p-4 backdrop-blur-sm"
						>
							<img
								src={logoUrl}
								alt=""
								class="h-full w-full object-contain opacity-80"
								loading="lazy"
							/>
						</div>
					</div>
				{:else}
					<!-- Ultimate fallback: Calendar icon -->
					<div class="flex h-full w-full items-center justify-center">
						<Calendar class="h-16 w-16 text-poster-white/60" aria-hidden="true" />
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Badges overlay (top-right) -->
	{#if showBadges}
		<div class="absolute right-2 top-2 z-10">
			<EventBadges {event} {userStatus} />
		</div>
	{/if}
</div>
