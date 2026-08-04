<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronRight, Ticket, Mail, CheckCircle2 } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import ToneTile from '$lib/components/common/ToneTile.svelte';

	interface Props {
		activeTicketsCount: number;
		pendingInvitationsCount: number;
		upcomingRsvpsCount: number;
	}
	let { activeTicketsCount, pendingInvitationsCount, upcomingRsvpsCount }: Props = $props();

	// These three tiles are the first thing on the dashboard and they now sit on
	// the welcome band's bottom edge, so they take the poster silhouette the
	// rest of the app's surfaces gained: 2px edge, `shadow-poster` at rest,
	// `shadow-poster-lg` on hover (the float grows instead of a generic
	// shadow-lg). Colours are unchanged — `bg-card` + ToneTile's audited tints.
	//
	// The transition is scoped to colours (was `transition-all`): the focus ring
	// is a box-shadow, so transitioning box-shadow would fade it in instead of
	// showing it at once. The border colour still animates; the float snaps.
	const activityCard =
		'group rounded-lg border-2 bg-card p-6 shadow-poster transition-colors hover:border-primary hover:shadow-poster-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';
</script>

<!-- Activity Summary Cards -->
{#if activeTicketsCount > 0 || pendingInvitationsCount > 0 || upcomingRsvpsCount > 0}
	<div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<!-- Active Tickets -->
		{#if activeTicketsCount > 0}
			<a href={resolve('/(auth)/dashboard/tickets', {})} class={activityCard}>
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<ToneTile tone="info" icon={Ticket} size="lg" />
						<div>
							<p class="text-sm font-medium text-muted-foreground">
								{m['dashboard.activityCards.activeTickets']()}
							</p>
							<p class="text-3xl font-black">{activeTicketsCount}</p>
						</div>
					</div>
					<ChevronRight
						class="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1"
						aria-hidden="true"
					/>
				</div>
				<p class="mt-4 text-sm text-muted-foreground">
					{m['dashboard.activityCards.activeTicketsDescription']({
						count: activeTicketsCount,
						ticketPlural:
							activeTicketsCount === 1 ? m['common.plurals_event']() : m['common.plurals_events']()
					})}
				</p>
			</a>
		{/if}

		<!-- Upcoming RSVPs -->
		{#if upcomingRsvpsCount > 0}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() validates the path; the appended query/fragment cannot be expressed through resolve() -->
			<a href={`${resolve('/(auth)/dashboard/rsvps', {})}?status=yes,maybe`} class={activityCard}>
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<ToneTile tone="success" icon={CheckCircle2} size="lg" />
						<div>
							<p class="text-sm font-medium text-muted-foreground">
								{m['dashboard.activityCards.upcomingRsvps']()}
							</p>
							<p class="text-3xl font-black">{upcomingRsvpsCount}</p>
						</div>
					</div>
					<ChevronRight
						class="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1"
						aria-hidden="true"
					/>
				</div>
				<p class="mt-4 text-sm text-muted-foreground">
					{m['dashboard.activityCards.upcomingRsvpsDescription']({
						count: upcomingRsvpsCount,
						eventPlural:
							upcomingRsvpsCount === 1 ? m['common.plurals_event']() : m['common.plurals_events']()
					})}
				</p>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}

		<!-- Pending Invitations -->
		{#if pendingInvitationsCount > 0}
			<a href={resolve('/(auth)/dashboard/invitations', {})} class={activityCard}>
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<ToneTile tone="brand" icon={Mail} size="lg" />
						<div>
							<p class="text-sm font-medium text-muted-foreground">
								{m['dashboard.activityCards.pendingInvitations']()}
							</p>
							<p class="text-3xl font-black">{pendingInvitationsCount}</p>
						</div>
					</div>
					<ChevronRight
						class="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1"
						aria-hidden="true"
					/>
				</div>
				<p class="mt-4 text-sm text-muted-foreground">
					{m['dashboard.activityCards.pendingInvitationsDescription']({
						count: pendingInvitationsCount,
						invitationPlural:
							pendingInvitationsCount === 1
								? m['common.plurals_invitation']()
								: m['common.plurals_invitations']()
					})}
				</p>
			</a>
		{/if}
	</div>
{/if}
