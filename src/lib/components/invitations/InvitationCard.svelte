<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MyEventInvitationSchema } from '$lib/api/generated/types.gen';
	import { Card } from '$lib/components/ui/card';
	import { Calendar, MapPin, Ticket, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-svelte';
	import { getImageUrl } from '$lib/utils/url';
	import { formatEventDateRange, formatDate } from '$lib/utils/date';
	import { getEventLogo, getEventLogoThumbnail } from '$lib/utils/event';

	interface Props {
		invitation: MyEventInvitationSchema;
	}

	const { invitation }: Props = $props();

	let messageExpanded = $state(false);

	// Logo with fallback hierarchy: event -> series -> organization
	// Prefer thumbnail for card display (64x64)
	const logoThumbnailPath = $derived(getEventLogoThumbnail(invitation.event));
	const logoPath = $derived(getEventLogo(invitation.event));
	const logoUrl = $derived(getImageUrl(logoThumbnailPath || logoPath));

	// Format event date
	const eventDate = $derived.by(() => {
		if (!invitation.event.start) return null;
		return formatEventDateRange(invitation.event.start, invitation.event.start);
	});

	// Get event location
	const eventLocation = $derived.by(() => {
		const event = invitation.event as any;
		return event.venue_name || event.location || null;
	});

	// Format created date
	const createdDate = $derived(formatDate(invitation.created_at));

	// Get privileges granted by this invitation
	const privileges = $derived.by(() => {
		const priv: string[] = [];
		if (invitation.waives_purchase) priv.push(m['invitationCard.privFreeAdmission']());
		if (invitation.waives_questionnaire) priv.push(m['invitationCard.privNoQuestionnaire']());
		if (invitation.waives_membership_required) priv.push(m['invitationCard.privNoMembership']());
		if (invitation.waives_rsvp_deadline) priv.push(m['invitationCard.privExtendedDeadline']());
		if (invitation.overrides_max_attendees) priv.push(m['invitationCard.privPriorityAccess']());
		if (invitation.tiers?.length)
			priv.push(
				m['invitationCard.privAssignedTiers']({
					tiers: invitation.tiers.map((t) => t.name).join(', ')
				})
			);
		return priv;
	});
</script>

<Card class="group overflow-hidden transition-shadow hover:shadow-lg">
	<div class="flex flex-col gap-4 p-4 md:p-6">
		<!-- Header with Event Info -->
		<div class="flex items-start gap-4">
			<!-- Event Logo/Icon (with fallback: event -> series -> org) -->
			<div class="shrink-0">
				{#if logoUrl}
					<img src={logoUrl} alt="" class="h-16 w-16 rounded-lg border object-cover" />
				{:else}
					<div
						class="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary"
					>
						<Ticket class="h-8 w-8" aria-hidden="true" />
					</div>
				{/if}
			</div>

			<!-- Event Details -->
			<div class="min-w-0 flex-1">
				<div class="mb-2">
					<h3 class="text-lg font-semibold">
						<a
							href="/events/{invitation.event.id}"
							class="hover:underline focus:underline focus:outline-none"
						>
							{invitation.event.name}
						</a>
					</h3>
					<div
						class="mt-1 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300"
					>
						<CheckCircle2 class="h-3 w-3" aria-hidden="true" />
						{m['invitationCard.specialInvitation']()}
					</div>
				</div>

				<!-- Event Metadata -->
				<dl class="space-y-1.5 text-sm">
					{#if eventDate}
						<div class="flex items-center gap-2 text-muted-foreground">
							<Calendar class="h-4 w-4 shrink-0" aria-hidden="true" />
							<dd class="truncate">{eventDate}</dd>
						</div>
					{/if}
					{#if eventLocation}
						<div class="flex items-center gap-2 text-muted-foreground">
							<MapPin class="h-4 w-4 shrink-0" aria-hidden="true" />
							<dd class="truncate">{eventLocation}</dd>
						</div>
					{/if}
				</dl>
			</div>
		</div>

		<!-- Custom Message -->
		{#if invitation.custom_message}
			<div class="rounded-md border bg-muted/50 p-3">
				<p
					id="invitation-message-{invitation.event.id}"
					class="text-sm italic text-muted-foreground"
					class:line-clamp-3={!messageExpanded}
				>
					"{invitation.custom_message}"
				</p>
				{#if invitation.custom_message.length > 150}
					<button
						type="button"
						onclick={() => (messageExpanded = !messageExpanded)}
						aria-expanded={messageExpanded}
						aria-controls="invitation-message-{invitation.event.id}"
						class="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
					>
						{#if messageExpanded}
							{m['invitationCard.showLess']()}
							<ChevronUp class="h-3 w-3" aria-hidden="true" />
						{:else}
							{m['invitationCard.showMore']()}
							<ChevronDown class="h-3 w-3" aria-hidden="true" />
						{/if}
					</button>
				{/if}
			</div>
		{/if}

		<!-- Privileges/Benefits -->
		{#if privileges.length > 0}
			<div>
				<h4 class="mb-2 text-sm font-semibold">{m['invitationCard.specialPrivileges']()}</h4>
				<ul class="space-y-1">
					{#each privileges as privilege}
						<li class="flex items-center gap-2 text-sm">
							<CheckCircle2 class="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
							{privilege}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Footer -->
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm"
		>
			<div class="text-muted-foreground">
				<span class="font-medium">{m['invitationCard.invited']()}</span>
				{createdDate}
			</div>

			<a
				href="/events/{invitation.event.id}"
				class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				{m['invitationCard.viewEvent']()}
			</a>
		</div>
	</div>
</Card>
