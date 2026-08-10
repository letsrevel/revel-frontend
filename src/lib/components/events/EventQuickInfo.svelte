<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';
	import {
		formatDateTime,
		formatEventDate,
		getRSVPDeadlineRelative,
		isRSVPClosingSoon
	} from '$lib/utils/date';
	import { cn } from '$lib/utils/cn';
	import {
		Calendar,
		MapPin,
		Users,
		Clock,
		Globe,
		Building2,
		ExternalLink,
		Info,
		Video
	} from '@lucide/svelte';
	import VenueInfoModal from '$lib/components/venues/VenueInfoModal.svelte';
	import { sanitizeMapEmbedUrl } from '$lib/utils/maps';
	import { asHttpUrl } from '$lib/utils/url';

	interface Props {
		event: EventDetailSchema;
		variant?: 'compact' | 'detailed';
		class?: string;
	}

	const { event, variant = 'compact', class: className }: Props = $props();

	// Computed values
	const formattedStartDate = $derived(formatEventDate(event.start, event.timezone));

	// Maps URLs - prioritize event's data, fall back to venue's data
	const mapsUrl = $derived(event.location_maps_url || event.venue?.location_maps_url || null);
	const mapsEmbed = $derived(
		sanitizeMapEmbedUrl(event.location_maps_embed || event.venue?.location_maps_embed || null)
	);

	// Virtual events (#830): an `address` holding an http(s) URL is the join
	// link — rendered as an anchor in the virtual row, and kept OUT of the
	// location lines below (a raw URL is not a place). A plain-text address on
	// a virtual event still renders as location like before.
	const joinUrl = $derived(event.is_virtual ? asHttpUrl(event.address) : null);
	const locationAddress = $derived(joinUrl ? null : event.address);
	// With the join link shown and no physical anchor left, a "Location TBD"
	// row under "Virtual event" would be noise — drop the row entirely.
	const showLocationRow = $derived(!joinUrl || !!event.venue || !!event.city);

	// Location split into two lines for better readability
	const locationDisplay = $derived.by((): { primary: string; secondary?: string } => {
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
			return { primary: locationAddress || m['eventQuickInfo.locationTbd']() };
		}

		const cityCountry = event.city.country
			? `${event.city.name}, ${event.city.country}`
			: event.city.name;

		// If we have an address, it's primary and city is secondary
		if (locationAddress) {
			return { primary: locationAddress, secondary: cityCountry };
		}

		// Just city/country on primary line
		return { primary: cityCountry };
	});

	function formatEventTypeLabel(value: string): string {
		switch (value) {
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
	}

	const eventTypeDisplay = $derived(formatEventTypeLabel((event.event_type as string) || 'public'));

	const eventTypeIcon = $derived.by(() => {
		const eventType = (event.event_type as string) || 'public';
		switch (eventType) {
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

	function formatVisibilityLabel(value: string): string {
		switch (value) {
			case 'public':
				return m['eventBadges.public']();
			case 'private':
				return m['eventBadges.private']();
			case 'members-only':
				return m['eventBadges.membersOnly']();
			case 'staff-only':
				return m['eventQuickInfo.staffOnly']();
			default:
				return value.replace(/-/g, ' ');
		}
	}

	// Show visibility only when it differs from event_type
	const visibilityMismatch = $derived.by(() => {
		const eventType = (event.event_type as string) || 'public';
		const visibility = event.visibility || 'public';
		if (eventType === visibility) return null;
		return formatVisibilityLabel(visibility);
	});

	// Capacity and attendee count are each withheld (`null`) when the event hides
	// them (#825). Each line is only rendered when the numbers it needs are known;
	// with none of them known the always-public `is_full` can still state the one
	// fact the organizer cannot hide. "Not full" says nothing (an uncapped event
	// is never full either), so that case omits the row entirely.
	const capacityDisplay = $derived.by(() => {
		const max = event.max_attendees;
		const count = event.attendee_count;
		// Show "X / Y spots taken" when both the limit and the count are disclosed
		if (max != null && max > 0 && count != null) {
			return m['eventQuickInfo.spotsTaken']({ current: count, max });
		}
		// Show "X attending" when there's no disclosed limit but a disclosed count
		if (count != null && count > 0) {
			return m['eventQuickInfo.attendeeCount']({ count });
		}
		if (event.is_full === true) return m['eventQuickInfo.eventFull']();
		return null;
	});

	const isNearCapacity = $derived.by(() => {
		const max = event.max_attendees;
		const count = event.attendee_count;
		if (max == null || max === 0 || count == null) return false;
		const remaining = max - count;
		return remaining <= 10 && remaining > 0;
	});

	// The relative phrase already carries its own directional word ("in 6 days" /
	// "in 6 Tagen" / "em 6 dias"), so it must stand ALONE under the "RSVP deadline"
	// label — feeding it into a composing "RSVP by {deadline}" string doubled the
	// preposition in every locale (#814). Same shape EventDetails already uses.
	// A null from getRSVPDeadlineRelative means the deadline has passed.
	const rsvpDeadlineText = $derived.by(() => {
		if (!event.rsvp_before) return null;
		return getRSVPDeadlineRelative(event.rsvp_before) ?? m['eventQuickInfo.rsvpClosed']();
	});

	// The relative phrase alone leaves the exact cutoff undiscoverable, so the
	// absolute instant is spelled out beneath it — in the event's timezone, with
	// the tz abbreviation formatDateTime appends.
	const rsvpDeadlineAbsolute = $derived(
		event.rsvp_before ? formatDateTime(event.rsvp_before, event.timezone) : null
	);

	const isDeadlineSoon = $derived.by(() => {
		if (!event.rsvp_before) return false;
		return isRSVPClosingSoon(event.rsvp_before);
	});

	// Container classes based on variant
	const containerClasses = $derived(
		cn(
			'space-y-2',
			variant === 'detailed' && 'space-y-3 text-base',
			variant === 'compact' && 'space-y-2 text-sm',
			className
		)
	);

	// Item classes based on variant
	const itemClasses = $derived(cn('flex items-start gap-2', variant === 'detailed' && 'gap-3'));

	// Icon classes based on variant
	const iconClasses = $derived(
		cn('shrink-0 text-muted-foreground', variant === 'detailed' ? 'h-5 w-5' : 'h-4 w-4')
	);

	// Text wrapper classes
	const textClasses = $derived('flex-1 min-w-0');

	// Venue info modal state
	let venueInfoModalOpen = $state(false);

	// Check if venue has meaningful additional info worth showing in modal
	const hasVenueAdditionalInfo = $derived.by(() => {
		if (!event.venue) return false;
		return !!(
			event.venue.description?.trim() ||
			(event.venue.capacity && event.venue.capacity > 0) ||
			event.venue.location_maps_embed
		);
	});
</script>

<div class={containerClasses} role="list" aria-label={m['eventQuickInfo.eventQuickInformation']()}>
	<!-- Date & Time -->
	<div class={itemClasses} role="listitem">
		<Calendar class={iconClasses} aria-hidden="true" />
		<div class={textClasses}>
			<time datetime={event.start} class="block font-bold">
				{formattedStartDate}
			</time>
		</div>
	</div>

	<!-- Virtual attendance (#830/BE #869): buyers deciding on a ticket deserve
	     to know attendance is remote before the description says so. -->
	{#if event.is_virtual}
		<div class={itemClasses} role="listitem">
			<Video class={iconClasses} aria-hidden="true" />
			<div class={textClasses}>
				<span class="block font-bold">{m['eventQuickInfo.virtualEvent']()}</span>
				{#if joinUrl}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- external URL (off-site); not an internal route -->
					<a
						href={joinUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="group block break-all text-primary hover:underline"
						aria-label={m['eventQuickInfo.openEventLink']()}
					>
						<span class="inline-flex items-center gap-1">
							{joinUrl}
							<ExternalLink
								class="h-3 w-3 shrink-0 opacity-70 group-hover:opacity-100"
								aria-hidden="true"
							/>
						</span>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
			</div>
		</div>
	{/if}

	<!-- Location -->
	{#if showLocationRow}
		<div class={itemClasses} role="listitem">
			<MapPin class={iconClasses} aria-hidden="true" />
			<div class={textClasses}>
				{#if mapsUrl}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- external URL (off-site); not an internal route -->
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
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{#if locationDisplay.secondary}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- external URL (off-site); not an internal route -->
						<a
							href={mapsUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="block text-xs text-muted-foreground hover:text-primary hover:underline"
						>
							{locationDisplay.secondary}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
				{:else}
					<span class="block">{locationDisplay.primary}</span>
					{#if locationDisplay.secondary}
						<span class="block text-xs text-muted-foreground">{locationDisplay.secondary}</span>
					{/if}
				{/if}
				{#if hasVenueAdditionalInfo && event.venue}
					<button
						type="button"
						onclick={() => (venueInfoModalOpen = true)}
						class="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
					>
						<Info class="h-3 w-3" aria-hidden="true" />
						{m['venueInfo.moreInfo']()}
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Map Embed -->
	{#if mapsEmbed}
		<div class="mt-3 overflow-hidden rounded-lg border" role="listitem">
			<iframe
				src={mapsEmbed}
				width="100%"
				height="200"
				style="border:0;"
				sandbox="allow-scripts"
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
				{#if visibilityMismatch}
					<span class="block text-xs text-muted-foreground">
						{m['eventQuickInfo.visibilityNote']({ visibility: visibilityMismatch })}
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Capacity Status (if max_capacity exists) -->
	{#if capacityDisplay}
		<!-- `text-warning` compiled to nothing (no `--warning` token; the tone
		     vocabulary maps warning -> highlight), so this row rendered plain.
		     These are compact sidebar rows with no container to tint, so the
		     emphasis has to be the text: `highlight-foreground` in light (15.90:1
		     on the card — legible, near-ink) flipping to `highlight` in dark
		     (9.17:1). The flip is mandatory: amber is 1.94:1 on a light card. The
		     "Limited spots" / "Closes soon" line beneath says it in words, so
		     nothing here is carried by colour alone. -->
		<div
			class={cn(itemClasses, isNearCapacity && 'text-highlight-foreground dark:text-highlight')}
			role="listitem"
			aria-live="polite"
		>
			<Users class={iconClasses} aria-hidden="true" />
			<div class={textClasses}>
				<span class="block font-bold">{capacityDisplay}</span>
				{#if isNearCapacity}
					<span class="text-xs text-muted-foreground">{m['eventQuickInfo.limitedSpots']()}</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- RSVP Deadline (if rsvp_closes_at exists and event is not ticketed) -->
	{#if rsvpDeadlineText && !event.requires_ticket}
		<div
			class={cn(itemClasses, isDeadlineSoon && 'text-highlight-foreground dark:text-highlight')}
			role="listitem"
			aria-live="polite"
		>
			<Clock class={iconClasses} aria-hidden="true" />
			<div class={textClasses}>
				<span
					class="block text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
				>
					{m['eventDetails.rsvpDeadline_label']()}
				</span>
				<!-- Both lines describe the same instant, so one <time> wraps them:
				     the relative phrase reads first, the exact cutoff sits under it. -->
				<time datetime={event.rsvp_before} class="block">
					<span class="block font-bold">{rsvpDeadlineText}</span>
					{#if rsvpDeadlineAbsolute}
						<span class="block text-xs font-normal text-muted-foreground">
							{rsvpDeadlineAbsolute}
						</span>
					{/if}
				</time>
				{#if isDeadlineSoon}
					<span class="text-xs text-muted-foreground">{m['eventQuickInfo.closesSoon']()}</span>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Venue Info Modal -->
{#if event.venue && hasVenueAdditionalInfo}
	<VenueInfoModal
		bind:open={venueInfoModalOpen}
		venue={event.venue}
		onClose={() => (venueInfoModalOpen = false)}
	/>
{/if}
