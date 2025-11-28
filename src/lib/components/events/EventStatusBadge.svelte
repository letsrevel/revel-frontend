<script lang="ts">
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import {
		Calendar,
		Clock,
		CheckCircle,
		AlertCircle,
		Ban,
		XCircle,
		FileText,
		type Icon
	} from 'lucide-svelte';
	import type { ComponentType } from 'svelte';

	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		event: EventDetailSchema;
		class?: string;
	}

	let { event, class: className }: Props = $props();

	/**
	 * Badge configuration with label, variant, and icon
	 */
	interface BadgeConfig {
		label: string;
		variant: 'success' | 'default' | 'secondary' | 'destructive' | 'cancelled';
		icon: ComponentType<Icon>;
	}

	/**
	 * Determine the event status based on various conditions
	 * Priority order:
	 * 0. Administrative Status (draft, closed, cancelled) - HIGHEST PRIORITY
	 * 1. Full (if at capacity)
	 * 2. Happening Today (if start date is today)
	 * 3. Ongoing (if current time is between start and end)
	 * 4. Past (if end time has passed)
	 * 5. Upcoming (default for future events)
	 *
	 * Note: Administrative status takes precedence over temporal status
	 */
	let badge = $derived.by((): BadgeConfig => {
		// 0. Check administrative status first (HIGHEST PRIORITY)
		if (event.status === 'draft') {
			return {
				label: m['orgAdmin.events.status.draft'](),
				variant: 'secondary',
				icon: FileText
			};
		}

		if (event.status === 'cancelled') {
			return {
				label: m['orgAdmin.events.status.cancelled'](),
				variant: 'cancelled',
				icon: Ban
			};
		}

		if (event.status === 'closed') {
			return {
				label: m['orgAdmin.events.status.closed'](),
				variant: 'destructive',
				icon: XCircle
			};
		}

		// If status is 'open', continue with temporal status checks
		const now = new Date();
		const startDate = new Date(event.start);
		const endDate = new Date(event.end);

		// 1. Check if full (has capacity and reached it)
		const maxAttendees = event.max_attendees ?? 0;
		if (maxAttendees > 0 && event.attendee_count >= maxAttendees) {
			return {
				label: m['eventStatus.full'](),
				variant: 'destructive',
				icon: AlertCircle
			};
		}

		// 2. Check if past
		if (endDate < now) {
			return {
				label: m['eventStatus.past'](),
				variant: 'secondary',
				icon: CheckCircle
			};
		}

		// 3. Check if ongoing (started but not ended)
		if (startDate <= now && now <= endDate) {
			return {
				label: m['eventStatus.ongoing'](),
				variant: 'success',
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
				variant: 'success',
				icon: Calendar
			};
		}

		// 5. Default: Upcoming
		return {
			label: m['eventStatus.upcoming'](),
			variant: 'default',
			icon: Calendar
		};
	});

	/**
	 * Get Tailwind classes for badge variant
	 */
	function getBadgeClasses(variant: BadgeConfig['variant']): string {
		const baseClasses =
			'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors';

		const variantClasses = {
			success:
				'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800',
			default: 'bg-primary text-primary-foreground hover:bg-primary/90',
			secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
			destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
			cancelled:
				'bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800'
		};

		return cn(baseClasses, variantClasses[variant]);
	}
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
	{@const IconComponent = badge.icon}
	<span class={cn(getBadgeClasses(badge.variant), className)} role="status" aria-live="polite">
		<IconComponent class="h-3 w-3" aria-hidden="true" />
		<span>{badge.label}</span>
	</span>
{/if}
