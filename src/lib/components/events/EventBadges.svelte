<script lang="ts">
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import type { UserEventStatus } from './types';
	import { isEventPast, isRSVPClosed } from '$lib/utils/date';
	import { isEventFull } from '$lib/utils/event';
	import { cn } from '$lib/utils/cn';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import { EyeOff } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Badge {
		label: string;
		/**
		 * Semantic tone, resolved here rather than a private colour table — the
		 * domain→tone mapper the rebrand asks for, so every fill is an audited
		 * `StatusBadge` pair. The old `outline` and `secondary` variants both land
		 * on `neutral`: they always said "context, not status", and nothing here
		 * was ever distinguished by fill alone (every badge is a word).
		 */
		tone: Tone;
		hasIcon?: boolean;
	}

	interface Props {
		event: EventInListSchema;
		userStatus?: UserEventStatus | null;
		class?: string;
	}

	const { event, userStatus = null, class: className }: Props = $props();

	/**
	 * Calculate which badges to show based on priority system
	 * Maximum 2 badges per card
	 */
	const badges = $derived.by(() => {
		const result: Badge[] = [];

		// Priority 0: Administrative Status (highest priority - show event status)
		// These badges indicate the event's administrative state
		if (event.status === 'draft') {
			result.push({ label: m['orgAdmin.events.status.draft'](), tone: 'neutral' });
		} else if (event.status === 'cancelled') {
			result.push({ label: m['orgAdmin.events.status.cancelled'](), tone: 'warning' });
		} else if (event.status === 'closed') {
			result.push({ label: m['orgAdmin.events.status.closed'](), tone: 'danger' });
		}

		// Priority 0.5: Unlisted visibility (important context for staff/owners who can see it)
		if (event.visibility === 'unlisted') {
			result.push({ label: m['eventBadges.unlisted'](), tone: 'neutral', hasIcon: true });
		}

		// If we already have 2 badges, stop here
		if (result.length >= 2) return result;

		// Priority 1: User Relationship
		if (userStatus) {
			if (userStatus.organizing) {
				result.push({ label: m['eventBadges.youreOrganizing'](), tone: 'brand' });
			} else if (userStatus.attending) {
				result.push({ label: m['eventBadges.youreAttending'](), tone: 'success' });
			} else if (userStatus.invitationPending) {
				result.push({ label: m['eventBadges.invitationPending'](), tone: 'neutral' });
			}
		}

		// If we already have 2 badges, stop here
		if (result.length >= 2) return result;

		// Priority 2: Availability/Status
		const isPast = isEventPast(event.end);
		const isFull = isEventFull(event);
		const rsvpClosed = isRSVPClosed(event.rsvp_before);

		if (isPast) {
			result.push({ label: m['eventBadges.pastEvent'](), tone: 'neutral' });
		} else if (isFull && !event.waitlist_open) {
			result.push({ label: m['eventBadges.soldOut'](), tone: 'danger' });
		} else if (isFull && event.waitlist_open) {
			result.push({ label: m['eventBadges.waitlistOpen'](), tone: 'info' });
		} else if (rsvpClosed) {
			result.push({ label: m['eventBadges.rsvpClosed'](), tone: 'neutral' });
		}

		// If we already have 2 badges, stop here
		if (result.length >= 2) return result;

		// Priority 3: Event Type (only if we have room)
		if (event.event_type === 'members-only') {
			result.push({ label: m['eventBadges.membersOnly'](), tone: 'neutral' });
		} else if (event.event_type === 'private') {
			result.push({ label: m['eventBadges.private'](), tone: 'neutral' });
		} else if (event.event_type === 'public') {
			result.push({ label: m['eventBadges.public'](), tone: 'neutral' });
		}

		// Return max 2 badges
		return result.slice(0, 2);
	});
</script>

{#if badges.length > 0}
	<div class={cn('flex flex-wrap gap-2', className)}>
		{#each badges as badge (badge.label)}
			<StatusBadge
				tone={badge.tone}
				label={badge.label}
				icon={badge.hasIcon ? EyeOff : undefined}
			/>
		{/each}
	</div>
{/if}
