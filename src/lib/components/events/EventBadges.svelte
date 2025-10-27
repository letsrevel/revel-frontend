<script lang="ts">
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import type { UserEventStatus } from './types';
	import { isEventPast, isRSVPClosed } from '$lib/utils/date';
	import { isEventFull } from '$lib/utils/event';
	import { cn } from '$lib/utils/cn';

	interface Badge {
		label: string;
		variant: 'default' | 'success' | 'secondary' | 'destructive' | 'outline';
	}

	interface Props {
		event: EventInListSchema;
		userStatus?: UserEventStatus | null;
		class?: string;
	}

	let { event, userStatus = null, class: className }: Props = $props();

	/**
	 * Calculate which badges to show based on priority system
	 * Maximum 2 badges per card
	 */
	let badges = $derived.by(() => {
		const result: Badge[] = [];

		// Priority 1: User Relationship (highest priority)
		if (userStatus) {
			if (userStatus.organizing) {
				result.push({ label: "You're Organizing", variant: 'default' });
			} else if (userStatus.attending) {
				result.push({ label: "You're Attending", variant: 'success' });
			} else if (userStatus.invitationPending) {
				result.push({ label: 'Invitation Pending', variant: 'secondary' });
			}
		}

		// If we already have 2 badges, stop here
		if (result.length >= 2) return result;

		// Priority 2: Availability/Status
		const isPast = isEventPast(event.end);
		const isFull = isEventFull(event);
		const rsvpClosed = isRSVPClosed(event.rsvp_before);

		if (isPast) {
			result.push({ label: 'Past Event', variant: 'outline' });
		} else if (isFull && !event.waitlist_open) {
			result.push({ label: 'Sold Out', variant: 'destructive' });
		} else if (isFull && event.waitlist_open) {
			result.push({ label: 'Waitlist Open', variant: 'secondary' });
		} else if (rsvpClosed) {
			result.push({ label: 'RSVP Closed', variant: 'outline' });
		}

		// If we already have 2 badges, stop here
		if (result.length >= 2) return result;

		// Priority 3: Event Type (only if we have room)
		if ((event.event_type as any) === 'members-only') {
			result.push({ label: 'Members Only', variant: 'secondary' });
		} else if ((event.event_type as any) === 'private') {
			result.push({ label: 'Private', variant: 'secondary' });
		} else if ((event.event_type as any) === 'public') {
			result.push({ label: 'Public', variant: 'outline' });
		}

		// Return max 2 badges
		return result.slice(0, 2);
	});

	/**
	 * Get Tailwind classes for badge variant
	 */
	function getBadgeClasses(variant: Badge['variant']): string {
		const baseClasses =
			'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors';

		const variantClasses = {
			default: 'bg-primary text-primary-foreground hover:bg-primary/90',
			success:
				'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800',
			secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
			destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
			outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
		};

		return cn(baseClasses, variantClasses[variant]);
	}
</script>

{#if badges.length > 0}
	<div class={cn('flex flex-wrap gap-2', className)}>
		{#each badges as badge}
			<span class={getBadgeClasses(badge.variant)}>
				{badge.label}
			</span>
		{/each}
	</div>
{/if}
