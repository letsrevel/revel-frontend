<script lang="ts">
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';
	import { formatEventDate, getRSVPDeadlineRelative, isRSVPClosingSoon } from '$lib/utils/date';
	import { Users, Clock, Info, Calendar, Eye } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import * as m from '$lib/paraglide/messages.js';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import EventTimezoneNote from './EventTimezoneNote.svelte';

	interface Props {
		event: EventDetailSchema;
		class?: string;
	}

	const { event, class: className }: Props = $props();

	// Compute RSVP deadline info
	const rsvpDeadlineText = $derived.by(() => {
		if (!event.rsvp_before) return null;
		return getRSVPDeadlineRelative(event.rsvp_before);
	});

	const isDeadlineSoon = $derived.by(() => {
		if (!event.rsvp_before) return false;
		return isRSVPClosingSoon(event.rsvp_before);
	});

	// Compute capacity info.
	//
	// Both numbers may be withheld (`null`) since #825 — an `=== undefined` guard
	// would let a withheld capacity through and render "Full" (null - count < 0),
	// so both are checked with `== null`.
	//
	// When the numbers are withheld the always-public `is_full` still lets us say
	// "Event is full" — the one fact that matters most and that the organizer
	// cannot hide. We deliberately do NOT show a "limited spots" hedge in the
	// not-full case: `is_full === false` is equally true of an uncapped event, so
	// it would invent scarcity. No numbers and not full ⇒ omit the row.
	const capacityText = $derived.by(() => {
		const max = event.max_attendees;
		const count = event.attendee_count;
		if (max == null || max === 0 || count == null) {
			return event.is_full === true ? m['eventDetails.attendance_full']() : null;
		}
		const remaining = max - count;
		if (remaining <= 0) return m['eventDetails.attendance_full']();
		if (remaining <= 10) return m['eventDetails.attendance_spotsLeft']({ count: remaining });
		return m['eventDetails.attendance_attending']({ count });
	});

	const isNearCapacity = $derived.by(() => {
		const max = event.max_attendees;
		const count = event.attendee_count;
		if (max == null || max === 0 || count == null) return false;
		const remaining = max - count;
		return remaining <= 10 && remaining > 0;
	});

	const seatsHeldText = $derived.by(() => {
		const held = event.seats_held ?? 0;
		if (held <= 0) return null;
		return m['orgAdmin.waitlist.offer.seatsHeldHint']({ count: held });
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

	// Show visibility when it differs from event_type
	const visibilityMismatch = $derived.by(() => {
		const eventType = (event.event_type as string) || 'public';
		const visibility = event.visibility || 'public';
		if (eventType === visibility) return null;
		return formatVisibilityLabel(visibility);
	});
</script>

<div class={cn('space-y-6', className)}>
	<!-- Description -->
	{#if event.description}
		{#key event.description}
			<section aria-labelledby="description-heading">
				<SectionHeader
					volume="celebration"
					id="description-heading"
					title={m['eventDetails.about_heading']()}
					class="mb-3"
				/>
				<MarkdownContent content={event.description} class="max-w-prose" />
			</section>
		{/key}
	{/if}

	<!-- Event Metadata Grid -->
	<section aria-labelledby="details-heading">
		<SectionHeader
			volume="celebration"
			id="details-heading"
			title={m['eventDetails.details_heading']()}
			class="mb-3"
		/>

		<div class="grid gap-4 md:grid-cols-2">
			<!-- Date & Time -->
			<div class="flex gap-3 rounded-lg border bg-card p-4">
				<Calendar class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<div class="flex-1">
					<div class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
						{m['eventDetails.dateTime_label']()}
					</div>
					<div class="mt-1">
						<time datetime={event.start} class="block font-bold">
							{formatEventDate(event.start, event.timezone, false)}
						</time>
						{#if event.is_open_ended}
							<span class="block text-sm text-muted-foreground">
								{m['eventDetails.openEnded']()}
							</span>
						{:else if event.end}
							<time datetime={event.end} class="block text-sm text-muted-foreground">
								{m['eventDetails.dateTime_ends']()}
								{formatEventDate(event.end, event.timezone, false)}
							</time>
						{/if}
						<EventTimezoneNote
							start={event.start}
							timeZone={event.timezone}
							place={event.city?.name}
							class="mt-2"
						/>
					</div>
				</div>
			</div>

			<!-- Capacity -->
			{#if capacityText}
				<!-- Urgency emphasis. There is no `--warning` token — the tone vocabulary
			     maps warning -> highlight — so the previous `border-warning
			     bg-warning/5` / `text-warning` compiled to NOTHING and this cell
			     rendered identically to its calm siblings.
			     What differentiates it, per mode, and why the text colour flips:
			       * the CONTAINER is the differentiator in light mode — a warm
			         `bg-highlight/10` wash beside plain white `bg-card` cells.
			         `border-highlight` is 1.94:1 on the light card, so it is
			         decoration, not the signal (WCAG 1.4.11 does not bind: this is
			         an informational cell, not a control, and the words —
			         "Only N spots left" / the relative deadline — carry the meaning).
			       * `--highlight-foreground` is near-ink, so in light mode it is
			         simply legible (14.88:1 on the tint) rather than emphatic; in
			         dark mode `text-highlight` is the amber emphasis (7.54:1 on the
			         tint). The flip is mandatory: amber itself is 1.94:1 on a light
			         card. Ratios hand-computed — composited alpha is invisible to
			         scripts/audit-brand-themes.py. -->
				<div
					class={cn(
						'flex gap-3 rounded-lg border p-4',
						isNearCapacity ? 'border-highlight bg-highlight/10' : 'bg-card'
					)}
				>
					<Users class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
					<div class="flex-1">
						<div class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
							{m['eventDetails.attendance_label']()}
						</div>
						<div
							class={cn(
								'mt-1 font-bold',
								isNearCapacity && 'text-highlight-foreground dark:text-highlight'
							)}
							aria-live="polite"
						>
							{capacityText}
							{#if seatsHeldText}
								<span class="ml-1 text-xs font-normal text-muted-foreground">
									· {seatsHeldText}
								</span>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- RSVP Deadline -->
			{#if rsvpDeadlineText}
				<!-- Same recipe and same reasoning as the capacity cell above. -->
				<div
					class={cn(
						'flex gap-3 rounded-lg border p-4',
						isDeadlineSoon ? 'border-highlight bg-highlight/10' : 'bg-card'
					)}
				>
					<Clock class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
					<div class="flex-1">
						<div class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
							{m['eventDetails.rsvpDeadline_label']()}
						</div>
						<time
							datetime={event.rsvp_before}
							class={cn(
								'mt-1 block font-bold',
								isDeadlineSoon && 'text-highlight-foreground dark:text-highlight'
							)}
							aria-live="polite"
						>
							{rsvpDeadlineText}
						</time>
					</div>
				</div>
			{/if}

			<!-- Event Type -->
			<div class="flex gap-3 rounded-lg border bg-card p-4">
				<Info class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<div class="flex-1">
					<div class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
						{m['eventDetails.eventType_label']()}
					</div>
					<div class="mt-1 font-bold capitalize">
						{event.event_type.replace('-', ' ')}
					</div>
					{#if visibilityMismatch}
						<div class="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
							<Eye class="h-3.5 w-3.5" aria-hidden="true" />
							<span>{m['eventDetails.visibilityNote']({ visibility: visibilityMismatch })}</span>
						</div>
					{/if}
					{#if event.requires_ticket}
						<div class="mt-1 text-sm text-muted-foreground">
							{m['eventDetails.eventType_ticketed']()}
						</div>
					{:else}
						<div class="mt-1 text-sm text-muted-foreground">
							{m['eventDetails.eventType_freeRsvp']()}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<!-- Invitation Message (if private event) -->
	{#if event.visibility === 'private' && event.invitation_message}
		{#key event.invitation_message}
			<section
				aria-labelledby="invitation-heading"
				class="rounded-lg border-2 border-primary/20 bg-primary/5 p-4"
			>
				<SectionHeader
					volume="celebration"
					id="invitation-heading"
					title={m['eventDetails.invitation_heading']()}
					class="mb-2"
				/>
				<MarkdownContent content={event.invitation_message} class="max-w-prose" />
			</section>
		{/key}
	{/if}
</div>
