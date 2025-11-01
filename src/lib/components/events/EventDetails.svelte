<script lang="ts">
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';
	import { formatEventDate, getRSVPDeadlineRelative, isRSVPClosingSoon } from '$lib/utils/date';
	import { Users, Clock, Info, Calendar } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		event: EventDetailSchema;
		class?: string;
	}

	let { event, class: className }: Props = $props();

	// Compute RSVP deadline info
	let rsvpDeadlineText = $derived.by(() => {
		if (!event.rsvp_before) return null;
		return getRSVPDeadlineRelative(event.rsvp_before);
	});

	let isDeadlineSoon = $derived.by(() => {
		if (!event.rsvp_before) return false;
		return isRSVPClosingSoon(event.rsvp_before);
	});

	// Compute capacity info
	let capacityText = $derived.by(() => {
		if (event.max_attendees === undefined || event.max_attendees === 0) return null;
		const remaining = event.max_attendees - event.attendee_count;
		if (remaining <= 0) return m['eventDetails.attendance_full']();
		if (remaining <= 10) return m['eventDetails.attendance_spotsLeft']({ count: remaining });
		return m['eventDetails.attendance_attending']({ count: event.attendee_count });
	});

	let isNearCapacity = $derived.by(() => {
		if (event.max_attendees === undefined || event.max_attendees === 0) return false;
		const remaining = event.max_attendees - event.attendee_count;
		return remaining <= 10 && remaining > 0;
	});
</script>

<div class={cn('space-y-6', className)}>
	<!-- Description -->
	{#if event.description_html}
		<section aria-labelledby="description-heading">
			<h2 id="description-heading" class="mb-3 text-xl font-semibold">{m['eventDetails.about_heading']()}</h2>
			<div class="prose prose-sm dark:prose-invert max-w-none">
				{@html event.description_html}
			</div>
		</section>
	{/if}

	<!-- Event Metadata Grid -->
	<section aria-labelledby="details-heading">
		<h2 id="details-heading" class="mb-3 text-xl font-semibold">{m['eventDetails.details_heading']()}</h2>

		<div class="grid gap-4 md:grid-cols-2">
			<!-- Date & Time -->
			<div class="flex gap-3 rounded-lg border bg-card p-4">
				<Calendar class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<div class="flex-1">
					<div class="text-sm font-medium text-muted-foreground">{m['eventDetails.dateTime_label']()}</div>
					<div class="mt-1">
						<time datetime={event.start} class="block font-medium">
							{formatEventDate(event.start)}
						</time>
						{#if event.end}
							<time datetime={event.end} class="block text-sm text-muted-foreground">
								{m['eventDetails.dateTime_ends']()} {formatEventDate(event.end)}
							</time>
						{/if}
					</div>
				</div>
			</div>

			<!-- Capacity -->
			{#if capacityText}
				<div
					class={cn(
						'flex gap-3 rounded-lg border p-4',
						isNearCapacity ? 'border-warning bg-warning/5' : 'bg-card'
					)}
				>
					<Users class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
					<div class="flex-1">
						<div class="text-sm font-medium text-muted-foreground">{m['eventDetails.attendance_label']()}</div>
						<div
							class={cn('mt-1 font-medium', isNearCapacity && 'text-warning')}
							aria-live="polite"
						>
							{capacityText}
						</div>
					</div>
				</div>
			{/if}

			<!-- RSVP Deadline -->
			{#if rsvpDeadlineText}
				<div
					class={cn(
						'flex gap-3 rounded-lg border p-4',
						isDeadlineSoon ? 'border-warning bg-warning/5' : 'bg-card'
					)}
				>
					<Clock class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
					<div class="flex-1">
						<div class="text-sm font-medium text-muted-foreground">{m['eventDetails.rsvpDeadline_label']()}</div>
						<time
							datetime={event.rsvp_before}
							class={cn('mt-1 block font-medium', isDeadlineSoon && 'text-warning')}
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
					<div class="text-sm font-medium text-muted-foreground">{m['eventDetails.eventType_label']()}</div>
					<div class="mt-1 font-medium capitalize">
						{event.event_type.replace('-', ' ')}
					</div>
					{#if event.requires_ticket}
						<div class="mt-1 text-sm text-muted-foreground">{m['eventDetails.eventType_ticketed']()}</div>
					{:else}
						<div class="mt-1 text-sm text-muted-foreground">{m['eventDetails.eventType_freeRsvp']()}</div>
					{/if}
				</div>
			</div>
		</div>
	</section>

	<!-- Tags -->
	{#if event.tags && event.tags.length > 0}
		<section aria-labelledby="tags-heading">
			<h2 id="tags-heading" class="mb-3 text-xl font-semibold">{m['eventDetails.tags_heading']()}</h2>
			<div class="flex flex-wrap gap-2">
				{#each event.tags as tag (tag)}
					<span class="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
						{tag}
					</span>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Event Series -->
	{#if event.event_series}
		<section aria-labelledby="series-heading">
			<h2 id="series-heading" class="mb-3 text-xl font-semibold">{m['eventDetails.series_heading']()}</h2>
			<a
				href="/events/{event.organization.slug}/series/{event.event_series.slug}"
				class="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<div class="font-semibold">{event.event_series.name}</div>
				{#if event.event_series.description}
					<p class="mt-1 text-sm text-muted-foreground">
						{event.event_series.description}
					</p>
				{/if}
			</a>
		</section>
	{/if}

	<!-- Invitation Message (if private event) -->
	{#if event.visibility === 'private' && event.invitation_message_html}
		<section
			aria-labelledby="invitation-heading"
			class="rounded-lg border-2 border-primary/20 bg-primary/5 p-4"
		>
			<h2 id="invitation-heading" class="mb-2 text-lg font-semibold">{m['eventDetails.invitation_heading']()}</h2>
			<div class="prose prose-sm dark:prose-invert max-w-none">
				{@html event.invitation_message_html}
			</div>
		</section>
	{/if}
</div>
