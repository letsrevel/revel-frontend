<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import type { UserRsvpSchema } from '$lib/api/generated/types.gen';
	import { Card } from '$lib/components/ui/card';
	import { Calendar, MapPin, CheckCircle2, XCircle, HelpCircle } from '@lucide/svelte';
	import { getImageUrl } from '$lib/utils/url';
	import { formatDate, formatEventDate, formatEventDateRange } from '$lib/utils/date';
	import {
		getEventLogo,
		getEventLogoThumbnail,
		getEventCoverArt,
		getEventCoverArtThumbnail
	} from '$lib/utils/event';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';

	interface Props {
		rsvp: UserRsvpSchema;
	}

	const { rsvp }: Props = $props();

	// Logo with fallback hierarchy: event -> series -> organization
	// Prefer thumbnail for card display (64x64)
	const logoThumbnailPath = $derived(getEventLogoThumbnail(rsvp.event));
	const logoPath = $derived(getEventLogo(rsvp.event));
	const logoUrl = $derived(getImageUrl(logoThumbnailPath || logoPath));

	// Cover art with fallback hierarchy (for secondary fallback)
	// Prefer thumbnail for card display
	const coverArtThumbnailPath = $derived(getEventCoverArtThumbnail(rsvp.event));
	const coverArtPath = $derived(getEventCoverArt(rsvp.event));
	const coverArtUrl = $derived(getImageUrl(coverArtThumbnailPath || coverArtPath));

	// Format event date
	const eventDate = $derived.by(() => {
		if (!rsvp.event.start) return null;
		if (rsvp.event.is_open_ended) {
			return `${formatEventDate(rsvp.event.start)} · ${m['eventDetails.openEnded']()}`;
		}
		return formatEventDateRange(rsvp.event.start, rsvp.event.end || rsvp.event.start);
	});

	// Get event location
	const eventLocation = $derived.by(() => {
		// venue_name/location are not modeled on the event schema but may be present at runtime
		const event = rsvp.event as typeof rsvp.event & {
			venue_name?: string | null;
			location?: string | null;
		};
		return event.venue_name || event.location || null;
	});

	// Format created date
	const createdDate = $derived(formatDate(rsvp.created_at));

	// Get RSVP status info — thin mapper onto the shared StatusBadge tone system
	// (same visible labels as before, solid-fill tokens instead of hand-picked hues).
	const statusInfo = $derived.by((): { label: string; icon: typeof CheckCircle2; tone: Tone } => {
		switch (rsvp.status) {
			case 'yes':
				return { label: m['rsvpCard.going'](), icon: CheckCircle2, tone: 'success' };
			case 'no':
				return { label: m['rsvpCard.notGoing'](), icon: XCircle, tone: 'danger' };
			case 'maybe':
				return { label: m['rsvpCard.maybe'](), icon: HelpCircle, tone: 'warning' };
			default:
				return { label: m['rsvpCard.unknown'](), icon: HelpCircle, tone: 'neutral' };
		}
	});

	const StatusIcon = $derived(statusInfo.icon);
</script>

<Card class="group overflow-hidden transition-shadow hover:shadow-poster-lg">
	<div class="flex flex-col gap-4 p-4 md:p-6">
		<!-- Header with Event Info -->
		<div class="flex items-start gap-4">
			<!-- Event Logo/Icon (with fallback: logo > cover art > icon) -->
			<div class="shrink-0">
				{#if logoUrl}
					<img src={logoUrl} alt="" class="h-16 w-16 rounded-lg border object-cover" />
				{:else if coverArtUrl}
					<img src={coverArtUrl} alt="" class="h-16 w-16 rounded-lg border object-cover" />
				{:else}
					<div
						class="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						<StatusIcon class="h-8 w-8" aria-hidden="true" />
					</div>
				{/if}
			</div>

			<!-- Event Details -->
			<div class="min-w-0 flex-1">
				<div class="mb-2">
					<h3 class="text-lg font-bold">
						<a
							href={resolve('/(public)/events/[id]', { id: rsvp.event.id })}
							class="hover:underline focus:underline focus:outline-none"
						>
							{rsvp.event.name}
						</a>
					</h3>
					<StatusBadge
						tone={statusInfo.tone}
						label={statusInfo.label}
						icon={StatusIcon}
						size="sm"
						class="mt-1"
					/>
				</div>

				<!-- Event Metadata -->
				<ul class="space-y-1.5 text-sm">
					{#if eventDate}
						<li class="flex items-center gap-2 text-muted-foreground">
							<Calendar class="h-4 w-4 shrink-0" aria-hidden="true" />
							<!-- datetime carries the machine-readable start instant; the text
							     is the localized (viewer-local) rendering. -->
							<time datetime={rsvp.event.start} class="truncate">{eventDate}</time>
						</li>
					{/if}
					{#if eventLocation}
						<li class="flex items-center gap-2 text-muted-foreground">
							<MapPin class="h-4 w-4 shrink-0" aria-hidden="true" />
							<span class="truncate">{eventLocation}</span>
						</li>
					{/if}
				</ul>
			</div>
		</div>

		<!-- Footer -->
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm"
		>
			<div class="text-muted-foreground">
				<span class="font-medium">{m['rsvpCard.rsvpd']()}</span>
				<time datetime={rsvp.created_at}>{createdDate}</time>
			</div>

			<a
				href={resolve('/(public)/events/[id]', { id: rsvp.event.id })}
				class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				{m['rsvpCard.viewEvent']()}
			</a>
		</div>
	</div>
</Card>
