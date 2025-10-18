<script lang="ts">
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import type { UserEventStatus } from './types';
	import { cn } from '$lib/utils/cn';
	import { formatEventDate, formatEventDateForScreenReader, isEventPast } from '$lib/utils/date';
	import {
		getEventAccessDisplay,
		getEventFallbackGradient
	} from '$lib/utils/event';
	import { Calendar, MapPin, Ticket } from 'lucide-svelte';
	import EventBadges from './EventBadges.svelte';

	interface Props {
		event: EventInListSchema;
		variant?: 'compact' | 'standard';
		userStatus?: UserEventStatus | null;
		class?: string;
	}

	let { event, variant = 'standard', userStatus = null, class: className }: Props = $props();

	// Image state
	let imageError = $state(false);

	// Computed values
	let formattedDate = $derived(formatEventDate(event.start));
	let screenReaderDate = $derived(formatEventDateForScreenReader(event.start));
	let locationDisplay = $derived.by(() => {
		if (!event.city) return 'TBD';
		return event.city.country ? `${event.city.name}, ${event.city.country}` : event.city.name;
	});
	let accessDisplay = $derived(
		getEventAccessDisplay(event, false, false) // TODO: Pass actual user membership status
	);
	let fallbackGradient = $derived(getEventFallbackGradient(event.id));
	let isPast = $derived(isEventPast(event.end));

	// Image URL with fallback
	let imageUrl = $derived(event.cover_art && !imageError ? event.cover_art : null);

	// Accessible card label for screen readers
	let accessibleLabel = $derived.by(() => {
		const parts = [
			event.name,
			`by ${event.organization.name}`,
			screenReaderDate,
			locationDisplay,
			accessDisplay
		];
		return parts.join(', ');
	});

	function handleImageError(): void {
		imageError = true;
	}

	// Container classes based on variant
	let containerClasses = $derived(
		cn(
			'group relative overflow-hidden rounded-lg border bg-card transition-all',
			'hover:shadow-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
			variant === 'compact' && 'flex flex-row md:flex-col',
			variant === 'standard' && 'flex flex-col',
			isPast && 'opacity-75',
			className
		)
	);

	// Image container classes based on variant
	let imageContainerClasses = $derived(
		cn(
			'relative overflow-hidden',
			variant === 'compact' && 'w-32 shrink-0 md:w-full md:aspect-video',
			variant === 'standard' && 'aspect-video'
		)
	);
</script>

<article class={containerClasses}>
	<!-- Clickable overlay link for accessibility -->
	<a
		href="/events/{event.organization.slug}/{event.slug}"
		data-sveltekit-preload-data="hover"
		class="absolute inset-0 z-10"
		aria-label={accessibleLabel}
	>
		<span class="sr-only">View event details</span>
	</a>

	<!-- Cover Image -->
	<div class={imageContainerClasses}>
		{#if imageUrl}
			<img
				src={imageUrl}
				alt=""
				class="h-full w-full object-cover transition-transform group-hover:scale-105"
				loading="lazy"
				onerror={handleImageError}
			/>
		{:else}
			<!-- Fallback gradient with organization logo -->
			<div class={cn('h-full w-full bg-gradient-to-br', fallbackGradient)}>
				{#if event.organization.logo}
					<div class="flex h-full w-full items-center justify-center p-8">
						<img
							src={event.organization.logo}
							alt=""
							class="max-h-full max-w-full object-contain opacity-80"
							loading="lazy"
						/>
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
		<div class="absolute right-2 top-2 z-20">
			<EventBadges {event} {userStatus} />
		</div>
	</div>

	<!-- Card Content -->
	<div
		class={cn(
			'flex flex-1 flex-col gap-3 p-4',
			variant === 'compact' && 'justify-center gap-1.5 md:gap-3'
		)}
	>
		<!-- Event Name & Organization -->
		<div class="space-y-1">
			<h3
				class={cn(
					'line-clamp-2 font-semibold leading-tight',
					variant === 'compact' ? 'text-base md:text-lg' : 'text-lg'
				)}
			>
				{event.name}
			</h3>
			<p
				class={cn(
					'text-muted-foreground',
					variant === 'compact' ? 'text-xs md:text-sm' : 'text-sm'
				)}
			>
				{event.organization.name}
			</p>
		</div>

		<!-- Event Details -->
		<div
			class={cn(
				'flex flex-col gap-2 border-t pt-3',
				variant === 'compact' && 'gap-1.5 border-t-0 pt-0 md:border-t md:pt-3'
			)}
		>
			<!-- Date & Time -->
			<div class="flex items-center gap-2 text-sm">
				<Calendar class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				<span class="truncate">{formattedDate}</span>
			</div>

			<!-- Location -->
			<div class="flex items-center gap-2 text-sm">
				<MapPin class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				<span class="truncate">{locationDisplay}</span>
			</div>

			{#if variant === 'standard'}
				<!-- Access Type (only in standard variant) -->
				<div class="flex items-center gap-2 text-sm">
					<Ticket class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<span class="truncate">{accessDisplay}</span>
				</div>
			{/if}
		</div>
	</div>
</article>
