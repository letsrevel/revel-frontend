<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';
	import { formatEventDate, getRSVPDeadlineRelative, isRSVPClosingSoon } from '$lib/utils/date';
	import { cn } from '$lib/utils/cn';
	import { Calendar, MapPin, Users, Clock, Globe, Building2 } from 'lucide-svelte';

	interface Props {
		event: EventDetailSchema;
		variant?: 'compact' | 'detailed';
		class?: string;
	}

	let { event, variant = 'compact', class: className }: Props = $props();

	// Computed values
	let formattedStartDate = $derived(formatEventDate(event.start));

	let locationDisplay = $derived.by(() => {
		// If event has a venue, use venue's name and city
		if (event.venue) {
			const city = event.venue.city || event.city;
			if (city) {
				const cityDisplay = city.country ? `${city.name}, ${city.country}` : city.name;
				return `${event.venue.name}, ${cityDisplay}`;
			}
			return event.venue.name;
		}

		// Fall back to event's city
		if (!event.city) return m['eventQuickInfo.locationTbd']();
		return event.city.country ? `${event.city.name}, ${event.city.country}` : event.city.name;
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
		if (!event.max_attendees || event.max_attendees === 0) return null;
		return m['eventQuickInfo.spotsTaken']({
			current: event.attendee_count,
			max: event.max_attendees
		});
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
			<span class="block">{locationDisplay}</span>
		</div>
	</div>

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
