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
	import { Calendar } from 'lucide-svelte';
	import EventBadges from './EventBadges.svelte';
	import type { UserEventStatus } from './types';

	interface Props {
		event: EventInListSchema;
		userStatus?: UserEventStatus | null;
		showBadges?: boolean;
		class?: string;
	}

	let { event, userStatus = null, showBadges = true, class: className }: Props = $props();

	// Image state
	let imageError = $state(false);

	// Computed values - prefer social preview for card display (1200x630, matches aspect-video ratio)
	let coverArtSocialPath = $derived(getEventCoverArtSocial(event));
	let coverArtPath = $derived(getEventCoverArt(event));
	let coverArtUrl = $derived(!imageError ? getImageUrl(coverArtSocialPath || coverArtPath) : null);
	let logoThumbnailPath = $derived(getEventLogoThumbnail(event));
	let logoPath = $derived(getEventLogo(event));
	let logoUrl = $derived(getImageUrl(logoThumbnailPath || logoPath));
	let fallbackGradient = $derived(getEventFallbackGradient(event.id));

	function handleImageError(): void {
		imageError = true;
	}
</script>

<div class={cn('relative aspect-video overflow-hidden', className)}>
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
						class="aspect-square w-full max-w-[60%] overflow-hidden rounded-lg bg-white/10 p-4 backdrop-blur-sm"
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
					<Calendar class="h-16 w-16 text-white opacity-50" aria-hidden="true" />
				</div>
			{/if}
		</div>
	{/if}

	<!-- Badges overlay (top-right) -->
	{#if showBadges}
		<div class="absolute right-2 top-2 z-10">
			<EventBadges {event} {userStatus} />
		</div>
	{/if}
</div>
