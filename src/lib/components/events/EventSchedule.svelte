<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventScheduleSession } from '$lib/api/generated/types.gen';
	import { formatTimeOfDay, formatDate } from '$lib/utils/date';
	import { AlertCircle, MapPin } from 'lucide-svelte';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import EventTimezoneNote from './EventTimezoneNote.svelte';

	interface Props {
		/** Display-only timeline entries; times are relative to the event start. */
		schedule?: EventScheduleSession[];
		/** ISO 8601 event start — the anchor every session offset is measured from. */
		eventStart: string;
		/** IANA timezone the event runs in; sessions render in it, not the viewer's. */
		timezone?: string | null;
		/** Human place name (e.g. the event's city) for the timezone note. */
		place?: string | null;
	}

	const { schedule = [], eventStart, timezone = null, place = null }: Props = $props();

	const tz = $derived(timezone ?? undefined);
	const startMs = $derived(new Date(eventStart).getTime());

	// Backend already orders by offset, but sort defensively so display never
	// depends on payload order.
	const sessions = $derived([...schedule].sort((a, b) => a.offset_minutes - b.offset_minutes));
	const hasSchedule = $derived(sessions.length > 0);

	// The event's own calendar day (in the event timezone) — sessions that fall
	// on it show time only; multi-day sessions get a date chip.
	const eventStartDay = $derived(formatDate(eventStart, tz));

	function instantOf(offsetMinutes: number): string {
		return new Date(startMs + offsetMinutes * 60_000).toISOString();
	}

	function timeLabel(session: EventScheduleSession): string {
		const start = instantOf(session.offset_minutes);
		const startTime = formatTimeOfDay(start, tz);
		if (!session.duration_minutes) return startTime;
		const end = new Date(
			startMs + (session.offset_minutes + session.duration_minutes) * 60_000
		).toISOString();
		return `${startTime} – ${formatTimeOfDay(end, tz)}`;
	}

	function dayLabel(session: EventScheduleSession): string | null {
		const day = formatDate(instantOf(session.offset_minutes), tz);
		return day === eventStartDay ? null : day;
	}
</script>

{#if hasSchedule}
	<section class="rounded-lg border bg-card p-6" aria-labelledby="schedule-heading">
		<h2 id="schedule-heading" class="mb-4 text-xl font-bold">{m['eventSchedule.title']()}</h2>
		<p class="mb-2 text-sm text-muted-foreground">{m['eventSchedule.description']()}</p>

		<!-- Times below are in the event timezone, not the viewer's — shown once here. -->
		<EventTimezoneNote start={eventStart} timeZone={timezone} {place} class="mb-6" />

		<ol class="space-y-3">
			{#each sessions as session, index (index)}
				{@const day = dayLabel(session)}
				<li class="flex items-start gap-4 rounded-md border p-4">
					<!-- Time column -->
					<div class="w-24 shrink-0 sm:w-28">
						<p class="text-sm font-semibold tabular-nums leading-tight">{timeLabel(session)}</p>
						{#if day}
							<p class="mt-0.5 text-xs text-muted-foreground">{day}</p>
						{/if}
					</div>

					<!-- Details -->
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<h3 class="font-semibold leading-tight">{session.title}</h3>
							{#if session.is_required}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
								>
									<AlertCircle class="h-3 w-3" aria-hidden="true" />
									{m['eventSchedule.requiredBadge']()}
								</span>
							{/if}
						</div>

						{#if session.location}
							<p class="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
								<MapPin class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
								<span class="min-w-0 truncate">{session.location}</span>
							</p>
						{/if}

						{#if session.description}
							<MarkdownContent
								content={session.description}
								inline
								class="!prose-sm mt-1 text-muted-foreground [&>*]:m-0"
							/>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
	</section>
{/if}
