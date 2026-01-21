<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';
	import { formatEventDate, getRSVPDeadlineRelative, isRSVPClosingSoon } from '$lib/utils/date';
	import { cn } from '$lib/utils/cn';
	import { Calendar, MapPin, Users, Clock, Globe, Building2, ExternalLink } from 'lucide-svelte';

	interface Props {
		event: EventDetailSchema;
		variant?: 'compact' | 'detailed';
		class?: string;
	}

	let { event, variant = 'compact', class: className }: Props = $props();

	// Computed values
	let formattedStartDate = $derived(formatEventDate(event.start));

	// Maps URLs - prioritize event's data, fall back to venue's data
	let mapsUrl = $derived(event.location_maps_url || event.venue?.location_maps_url || null);
	let mapsEmbed = $derived(event.location_maps_embed || event.venue?.location_maps_embed || null);

	// Location split into two lines for better readability
	let locationDisplay = $derived.by((): { primary: string; secondary?: string } => {
		// If event has a venue, use venue's name and address as primary, city as secondary
		if (event.venue) {
			const primaryParts: string[] = [event.venue.name];

			// Add venue's street address if available
			if (event.venue.address) {
				primaryParts.push(event.venue.address);
			}

			// City/country goes on secondary line
			const city = event.venue.city || event.city;
			const secondary = city
				? city.country
					? `${city.name}, ${city.country}`
					: city.name
				: undefined;

			return { primary: primaryParts.join(', '), secondary };
		}

		// Fall back to event's address and city
		if (!event.city) {
			return { primary: event.address || m['eventQuickInfo.locationTbd']() };
		}

		const cityCountry = event.city.country
			? `${event.city.name}, ${event.city.country}`
			: event.city.name;

		// If we have an address, it's primary and city is secondary
		if (event.address) {
			return { primary: event.address, secondary: cityCountry };
		}

		// Just city/country on primary line
		return { primary: cityCountry };
	});

	let eventTypeDisplay = $derived.by(() => {
		switch (event.visibility) {
			case 'public':
				return m['eventQuickInfo.publicEvent']();
			case 'private':
				return m['eventQuickInfo.privateEvent']();
			case 'members-only':
				return m['eventQuickInfo.membersOnly']();
			case 'staff-only':
				return m['eventQuickInfo.staffOnly']();
			default:
				return m['eventQuickInfo.event']();
		}
	});

	let eventTypeIcon = $derived.by(() => {
		switch (event.visibility) {
			case 'public':
				return Globe;
			case 'private':
			case 'members-only':
			case 'staff-only':
				return Building2;
			default:
				return Globe;
		}
	});

	let capacityDisplay = $derived.by(() => {
		// Show "X / Y spots taken" when there's a max limit
		if (event.max_attendees && event.max_attendees > 0) {
			return m['eventQuickInfo.spotsTaken']({
				current: event.attendee_count,
				max: event.max_attendees
			});
		}
		// Show "X attending" when there's no limit but there are attendees
		if (event.attendee_count > 0) {
			return m['eventQuickInfo.attendeeCount']({ count: event.attendee_count });
		}
		return null;
	});

	let isNearCapacity = $derived.by(() => {
		if (!event.max_attendees || event.max_attendees === 0) return false;
		const remaining = event.max_attendees - event.attendee_count;
		return remaining <= 10 && remaining > 0;
	});

	let rsvpDeadlineDisplay = $derived.by(() => {
		if (!event.rsvp_before) return null;
		const relative = getRSVPDeadlineRelative(event.rsvp_before);
		return relative === 'closed'
			? m['eventQuickInfo.rsvpClosed']()
			: m['eventQuickInfo.rsvpBy']({ deadline: relative });
	});

	let isDeadlineSoon = $derived.by(() => {
		if (!event.rsvp_before) return false;
		return isRSVPClosingSoon(event.rsvp_before);
	});

	// Container classes based on variant
	let containerClasses = $derived(
		cn(
			'space-y-2',
			variant === 'detailed' && 'space-y-3 text-base',
			variant === 'compact' && 'space-y-2 text-sm',
			className
		)
	);

	// Item classes based on variant
	let itemClasses = $derived(cn('flex items-start gap-2', variant === 'detailed' && 'gap-3'));

	// Icon classes based on variant
	let iconClasses = $derived(
		cn('shrink-0 text-muted-foreground', variant === 'detailed' ? 'h-5 w-5' : 'h-4 w-4')
	);

	// Text wrapper classes
	let textClasses = $derived('flex-1 min-w-0');
</script>

<div class={containerClasses} role="list" aria-label="Event quick information">
	<!-- Date & Time -->
	<div class={itemClasses} role="listitem">
		<Calendar class={iconClasses} aria-hidden="true" />
		<div class={textClasses}>
			<time datetime={event.start} class="block font-medium">
				{formattedStartDate}
			</time>
		</div>
	</div>

	<!-- Location -->
	<div class={itemClasses} role="listitem">
		<MapPin class={iconClasses} aria-hidden="true" />
		<div class={textClasses}>
			{#if mapsUrl}
				<a
					href={mapsUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="group block text-primary hover:underline"
					aria-label="{locationDisplay.primary} - {m['eventQuickInfo.openInMaps']()}"
				>
					<span class="inline-flex items-center gap-1">
						{locationDisplay.primary}
						<ExternalLink class="h-3 w-3 opacity-70 group-hover:opacity-100" aria-hidden="true" />
					</span>
				</a>
				{#if locationDisplay.secondary}
					<a
						href={mapsUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="block text-xs text-muted-foreground hover:text-primary hover:underline"
					>
						{locationDisplay.secondary}
					</a>
				{/if}
			{:else}
				<span class="block">{locationDisplay.primary}</span>
				{#if locationDisplay.secondary}
					<span class="block text-xs text-muted-foreground">{locationDisplay.secondary}</span>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Map Embed -->
	{#if mapsEmbed}
		<div class="mt-3 overflow-hidden rounded-lg border" role="listitem">
			<iframe
				src={mapsEmbed}
				width="100%"
				height="200"
				style="border:0;"
				allowfullscreen
				loading="lazy"
				referrerpolicy="no-referrer-when-downgrade"
				title="{m['eventQuickInfo.mapOf']()} {locationDisplay.primary}"
			></iframe>
		</div>
	{/if}

	<!-- Event Type -->
	{#if eventTypeIcon}
		{@const IconComponent = eventTypeIcon}
		<div class={itemClasses} role="listitem">
			<IconComponent class={iconClasses} aria-hidden="true" />
			<div class={textClasses}>
				<span class="block">{eventTypeDisplay}</span>
			</div>
		</div>
	{/if}

	<!-- Capacity Status (if max_capacity exists) -->
	{#if capacityDisplay}
		<div
			class={cn(itemClasses, isNearCapacity && 'text-warning')}
			role="listitem"
			aria-live="polite"
		>
			<Users class={iconClasses} aria-hidden="true" />
			<div class={textClasses}>
				<span class="block font-medium">{capacityDisplay}</span>
				{#if isNearCapacity}
					<span class="text-xs text-muted-foreground">{m['eventQuickInfo.limitedSpots']()}</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- RSVP Deadline (if rsvp_closes_at exists and event is not ticketed) -->
	{#if rsvpDeadlineDisplay && !event.requires_ticket}
		<div
			class={cn(itemClasses, isDeadlineSoon && 'text-warning')}
			role="listitem"
			aria-live="polite"
		>
			<Clock class={iconClasses} aria-hidden="true" />
			<div class={textClasses}>
				<time datetime={event.rsvp_before} class="block font-medium">
					{rsvpDeadlineDisplay}
				</time>
				{#if isDeadlineSoon}
					<span class="text-xs text-muted-foreground">{m['eventQuickInfo.closesSoon']()}</span>
				{/if}
			</div>
		</div>
	{/if}
</div>
