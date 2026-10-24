<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { Calendar, Clock, MapPin, Plus } from '@lucide/svelte';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import EventStatusBadge from '$lib/components/events/EventStatusBadge.svelte';
	import {
		formatEventDateForScreenReader,
		formatRelativeTime,
		formatTimeOfDay
	} from '$lib/utils/date';
	import { getDateSlabParts } from '$lib/utils/calendar';

	interface Props {
		event: EventInListSchema | null;
		isHappeningNow: boolean;
		orgSlug: string;
		canCreateEvent: boolean;
		onCreateEvent: () => void;
	}

	const { event, isHappeningNow, orgSlug, canCreateEvent, onCreateEvent }: Props = $props();

	const slab = $derived(event ? getDateSlabParts(event.start, event.timezone) : null);
	const count = $derived(event?.attendee_count ?? 0);
	const max = $derived(event?.max_attendees ?? null);
	const fillPercent = $derived(max ? Math.min(100, (count / max) * 100) : 0);
</script>

<section aria-label={m['orgAdmin.dashboard.nextUp.label']()}>
	{#if event && slab}
		<div class="rounded-lg border border-border bg-card p-5 md:p-8">
			<!-- md+: the slab spans both rows, so title (row 1, bottom-aligned) and
			     capacity/actions (row 2, top-aligned) sit flush against each other
			     beside it. Mobile: capacity/actions drop under the slab, full width. -->
			<div class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-5 md:gap-x-8 md:gap-y-5">
				<div
					aria-hidden="true"
					class="flex w-24 flex-col items-center justify-center rounded-md bg-primary px-3 py-4 text-primary-foreground md:row-span-2 md:w-36 md:py-6"
				>
					<span class="text-sm font-extrabold">{slab.weekday}</span>
					<span class="text-6xl font-black tabular-nums leading-none md:text-8xl">{slab.day}</span>
					<span class="text-base font-bold md:text-lg">{slab.month}</span>
				</div>

				<div class="min-w-0 self-center md:self-end">
					<span class="sr-only">{formatEventDateForScreenReader(event.start, event.timezone)}</span>
					<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
						<h2 class="text-2xl font-extrabold leading-tight md:text-3xl">{event.name}</h2>
						{#if event.status !== 'open'}
							<EventStatusBadge {event} />
						{/if}
					</div>
					<div
						class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"
					>
						{#if isHappeningNow}
							<StatusBadge
								tone="success"
								size="sm"
								label={m['orgAdmin.dashboard.nextUp.happeningNow']()}
							/>
						{:else}
							<span class="inline-flex items-center gap-1.5">
								<Calendar class="h-4 w-4" aria-hidden="true" />
								{formatRelativeTime(event.start, event.timezone)}
							</span>
						{/if}
						<span class="inline-flex items-center gap-1.5">
							<Clock class="h-4 w-4" aria-hidden="true" />
							{formatTimeOfDay(event.start, event.timezone)}
						</span>
						{#if event.venue}
							<span class="inline-flex items-center gap-1.5">
								<MapPin class="h-4 w-4" aria-hidden="true" />
								{event.venue.name}
							</span>
						{/if}
					</div>
				</div>

				<div class="col-span-2 md:col-span-1 md:col-start-2 md:self-start">
					<div>
						{#if max}
							<div class="h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
								<div
									class="h-full rounded-full {event.is_full ? 'bg-accent' : 'bg-primary'}"
									style="width: {fillPercent}%"
								></div>
							</div>
							<p class="mt-2 text-sm font-semibold">
								{m['orgAdmin.dashboard.nextUp.going']({ count, max })}
							</p>
						{:else}
							<p class="text-sm font-semibold">
								{m['orgAdmin.dashboard.nextUp.goingNoCap']({ count })}
							</p>
						{/if}
					</div>

					<div class="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
						{#if event.requires_ticket}
							<Button
								href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/tickets', {
									slug: orgSlug,
									event_id: event.id
								})}
							>
								{m['orgAdmin.dashboard.nextUp.checkIn']()}
							</Button>
						{:else}
							<Button
								href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/attendees', {
									slug: orgSlug,
									event_id: event.id
								})}
							>
								{m['orgAdmin.dashboard.nextUp.guestList']()}
							</Button>
						{/if}
						<Button
							variant="outline"
							href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', {
								slug: orgSlug,
								event_id: event.id
							})}
						>
							{m['orgAdmin.dashboard.nextUp.edit']()}
						</Button>
						<Button
							variant="ghost"
							href={resolve('/(public)/events/[org_slug]/[event_slug]', {
								org_slug: orgSlug,
								event_slug: event.slug
							})}
						>
							{m['orgAdmin.dashboard.nextUp.viewPage']()}
						</Button>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="rounded-lg border border-border bg-card">
			<EmptyState
				icon={Calendar}
				title={m['orgAdmin.dashboard.nextUp.emptyTitle']()}
				body={m['orgAdmin.dashboard.nextUp.emptyDescription']()}
				level={2}
			>
				{#snippet action()}
					{#if canCreateEvent}
						<Button onclick={onCreateEvent}>
							<Plus aria-hidden="true" />
							{m['orgAdmin.dashboard.createEventButton']()}
						</Button>
					{/if}
				{/snippet}
			</EmptyState>
		</div>
	{/if}
</section>
