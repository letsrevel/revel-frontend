<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Clock, MapPin } from '@lucide/svelte';
	import { toISOString } from '$lib/utils/datetime';
	import {
		formatEventDayLabel,
		formatTimeOfDay,
		formatEventDateForScreenReader
	} from '$lib/utils/date';
	import { getDateSlabParts } from '$lib/utils/calendar';
	import { summarizeAccess, capitalizeFirst } from './access-summary';

	interface Props {
		name?: string | null;
		/** `datetime-local` value from the form (no timezone). */
		start?: string | null;
		end?: string | null;
		isOpenEnded?: boolean;
		venueName?: string | null;
		cityName?: string | null;
		visibility?: string | null;
		eventType?: string | null;
		requiresTicket?: boolean;
	}

	const {
		name,
		start,
		end,
		isOpenEnded = false,
		venueName,
		cityName,
		visibility,
		eventType,
		requiresTicket = false
	}: Props = $props();

	const startIso = $derived(toISOString(start));
	const endIso = $derived(isOpenEnded ? null : toISOString(end));
	// An unparseable value (half-typed input) must not throw during render.
	const startValid = $derived(!!startIso && !Number.isNaN(new Date(startIso).getTime()));
	const endValid = $derived(!!endIso && !Number.isNaN(new Date(endIso).getTime()));

	const slab = $derived(startValid && startIso ? getDateSlabParts(startIso) : null);
	const srDate = $derived(startValid && startIso ? formatEventDateForScreenReader(startIso) : '');
	// Date and time sit on separate lines so a narrow rail never wraps mid-phrase:
	// "Sun, Jul 26" over "7:00 PM – 11:00 PM" (same day) or
	// "7:00 PM – Mon, Jul 27, 1:00 AM" (multi-day).
	const whenDate = $derived(startValid && startIso ? formatEventDayLabel(startIso) : '');
	const whenTime = $derived.by((): string => {
		if (!startValid || !startIso) return '';
		const startTime = formatTimeOfDay(startIso);
		if (!endValid || !endIso) return startTime;
		const endTime = formatTimeOfDay(endIso);
		if (formatEventDayLabel(endIso) === whenDate) return `${startTime} – ${endTime}`;
		return `${startTime} – ${formatEventDayLabel(endIso)}, ${endTime}`;
	});
	const where = $derived(venueName || cityName || '');
	const access = $derived(summarizeAccess(visibility, eventType));
</script>

<section
	aria-label={m['eventEditor.glanceLabel']()}
	class="rounded-lg border border-border bg-card p-4"
>
	<div class="flex gap-4">
		<div
			aria-hidden="true"
			class="flex h-24 w-20 shrink-0 flex-col items-center justify-center rounded-md px-2 py-2 {slab
				? 'bg-primary text-primary-foreground'
				: 'border border-dashed border-border bg-muted text-muted-foreground'}"
		>
			{#if slab}
				<span class="text-xs font-extrabold">{slab.weekday}</span>
				<span class="text-4xl font-black tabular-nums leading-none">{slab.day}</span>
				<span class="text-sm font-bold">{slab.month}</span>
			{:else}
				<span class="text-3xl font-black leading-none">?</span>
			{/if}
		</div>

		<div class="min-w-0 flex-1">
			{#if srDate}<span class="sr-only">{srDate}</span>{/if}
			<p class="break-words text-lg font-extrabold leading-tight">
				{#if name}{name}{:else}<span class="text-muted-foreground"
						>{m['eventEditor.glanceNamePlaceholder']()}</span
					>{/if}
			</p>
			<ul class="mt-2 space-y-1 text-sm text-muted-foreground">
				<li class="flex items-start gap-1.5">
					<Clock class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
					{#if whenDate}
						<span><span class="block">{whenDate}</span><span class="block">{whenTime}</span></span>
					{:else}
						<span>{m['eventEditor.glanceNoDate']()}</span>
					{/if}
				</li>
				<li class="flex items-start gap-1.5">
					<MapPin class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
					<span>{where || m['eventEditor.glanceNoLocation']()}</span>
				</li>
			</ul>
		</div>
	</div>

	<div class="mt-4 space-y-1 border-t border-border pt-3 text-sm">
		<p>{m['eventEditor.glanceVisibleTo']({ who: access.whoCanSee })}</p>
		<p>{m['eventEditor.glanceCanAttend']({ who: capitalizeFirst(access.whoCanAttend) })}</p>
		<p class="font-semibold">
			{requiresTicket ? m['eventEditor.glanceTickets']() : m['eventEditor.glanceRsvp']()}
		</p>
	</div>
</section>
