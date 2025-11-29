<script lang="ts">
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import type { UserEventStatus } from './types';
	import { cn } from '$lib/utils/cn';
	import { formatEventDate, formatEventDateForScreenReader, isEventPast } from '$lib/utils/date';
	import { getEventAccessDisplay } from '$lib/utils/event';
	import { Calendar, MapPin, Ticket, Tag } from 'lucide-svelte';
	import EventCoverImage from './EventCoverImage.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { navigating } from '$app/stores';

	interface Props {
		event: EventInListSchema;
		variant?: 'compact' | 'standard';
		userStatus?: UserEventStatus | null;
		class?: string;
	}

	let { event, variant = 'standard', userStatus = null, class: className }: Props = $props();

	// Computed values
	let formattedDate = $derived(formatEventDate(event.start));
	let screenReaderDate = $derived(formatEventDateForScreenReader(event.start));
	let locationDisplay = $derived.by(() => {
		if (!event.city) return m['eventCard.location_tbd']();
		return event.city.country ? `${event.city.name}, ${event.city.country}` : event.city.name;
	});
	let accessDisplay = $derived(
		getEventAccessDisplay(event, false, false) // TODO: Pass actual user membership status
	);
	let isPast = $derived(isEventPast(event.end));

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

	// Check if we're currently navigating to this card's event
	let eventUrl = $derived(`/events/${event.organization.slug}/${event.slug}`);
	let isNavigating = $derived($navigating !== null && $navigating.to?.url.pathname === eventUrl);

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
		<span class="sr-only">{m['eventCard.viewDetails']()}</span>
	</a>

	<!-- Skeleton loader overlay when navigating -->
	{#if isNavigating}
		<div
			class="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm"
			role="status"
			aria-live="polite"
		>
			<div class="flex flex-col items-center gap-2">
				<div
					class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
					aria-hidden="true"
				></div>
				<span class="text-sm text-muted-foreground">{m['eventCard.loading']()}</span>
			</div>
		</div>
	{/if}

	<!-- Cover Image -->
	<EventCoverImage {event} {userStatus} class={imageContainerClasses} />

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

				<!-- Tags (if available) -->
				{#if event.tags && event.tags.length > 0}
					<div class="flex items-start gap-2 text-sm">
						<Tag class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<div class="flex flex-wrap gap-1">
							{#each event.tags.slice(0, 3) as tag}
								<span
									class="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
								>
									{tag}
								</span>
							{/each}
							{#if event.tags.length > 3}
								<span class="inline-block px-2 py-0.5 text-xs text-muted-foreground">
									+{event.tags.length - 3}
									{m['common.text_more']()}
								</span>
							{/if}
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</article>
