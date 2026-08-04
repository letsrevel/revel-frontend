<script lang="ts">
	import type { EventDetailSchema, EventStatus } from '$lib/api/generated/types.gen';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import {
		Calendar,
		Clock,
		CheckCircle,
		AlertCircle,
		Ban,
		XCircle,
		FileText,
		type LucideIcon
	} from '@lucide/svelte';

	import * as m from '$lib/paraglide/messages.js';

	/**
	 * Only the fields the badge actually reads. Both EventDetailSchema and
	 * EventInListSchema satisfy this, so the badge works in list contexts too.
	 */
	type EventStatusBadgeEvent = Pick<EventDetailSchema, 'status' | 'start' | 'end' | 'is_full'> & {
		status: EventStatus;
	};

	interface Props {
		event: EventStatusBadgeEvent;
		class?: string;
	}

	const { event, class: className }: Props = $props();

	/**
	 * Badge configuration with label, tone, and icon
	 */
	interface BadgeConfig {
		label: string;
		/**
		 * Semantic tone, resolved here rather than a private colour table: this is
		 * the domain→tone mapper the rebrand asks for, so every fill is an audited
		 * `StatusBadge` token pair.
		 *
		 * The one collapse worth naming: CANCELLED and CLOSED used to be two
		 * hand-picked hues (orange-700 / destructive). They stay distinguishable —
		 * cancelled is `warning` (amber, the organizer called it off), closed is
		 * `danger` (red, no longer joinable) — and, per the house rule, the label
		 * carries the distinction on its own for anyone who cannot separate the
		 * two hues.
		 */
		tone: Tone;
		icon: LucideIcon;
	}

	/**
	 * Determine the event status based on various conditions
	 * Priority order:
	 * 0. Administrative Status (draft, closed, cancelled) - HIGHEST PRIORITY
	 * 1. Past (if end time has passed — an ended event is "Past" even if it was full)
	 * 2. Full (if at capacity)
	 * 3. Ongoing (if current time is between start and end)
	 * 4. Happening Today (if start date is today)
	 * 5. Upcoming (default for future events)
	 *
	 * Note: Administrative status takes precedence over temporal status
	 */
	const badge = $derived.by((): BadgeConfig => {
		// 0. Check administrative status first (HIGHEST PRIORITY)
		if (event.status === 'draft') {
			return {
				label: m['orgAdmin.events.status.draft'](),
				tone: 'neutral',
				icon: FileText
			};
		}

		if (event.status === 'cancelled') {
			return {
				label: m['orgAdmin.events.status.cancelled'](),
				tone: 'warning',
				icon: Ban
			};
		}

		if (event.status === 'closed') {
			return {
				label: m['orgAdmin.events.status.closed'](),
				tone: 'danger',
				icon: XCircle
			};
		}

		// If status is 'open', continue with temporal status checks
		const now = new Date();
		const startDate = new Date(event.start);
		const endDate = new Date(event.end);

		// 1. Check if past (an ended event is "Past" even if it was full)
		if (endDate < now) {
			return {
				label: m['eventStatus.past'](),
				tone: 'neutral',
				icon: CheckCircle
			};
		}

		// 2. Check if full. `is_full` (#825) is always public, so this badge stays
		// truthful even when the event withholds `max_attendees`/`attendee_count`;
		// deriving fullness from those would silently read as "not full".
		if (event.is_full === true) {
			return {
				label: m['eventStatus.full'](),
				tone: 'danger',
				icon: AlertCircle
			};
		}

		// 3. Check if ongoing (started but not ended)
		if (startDate <= now && now <= endDate) {
			return {
				label: m['eventStatus.ongoing'](),
				tone: 'success',
				icon: Clock
			};
		}

		// 4. Check if happening today (same calendar day as start)
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
		const isToday = startDate >= todayStart && startDate <= todayEnd;

		if (isToday) {
			return {
				label: m['eventStatus.happeningToday'](),
				tone: 'success',
				icon: Calendar
			};
		}

		// 5. Default: Upcoming
		return {
			label: m['eventStatus.upcoming'](),
			tone: 'brand',
			icon: Calendar
		};
	});
</script>

<!--
  Event Status Badge Component

  Displays the current temporal status of an event with semantic color coding
  and appropriate iconography. Status is determined by event timing and capacity.

  @component
  @example
  <EventStatusBadge event={data.event} />
  <EventStatusBadge event={data.event} class="mb-4" />
-->
{#if badge}
	<StatusBadge
		tone={badge.tone}
		label={badge.label}
		icon={badge.icon}
		class={className}
		role="status"
		aria-live="polite"
	/>
{/if}
