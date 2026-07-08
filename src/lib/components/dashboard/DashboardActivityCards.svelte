<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronRight, Ticket, Mail, CheckCircle2 } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		activeTicketsCount: number;
		pendingInvitationsCount: number;
		upcomingRsvpsCount: number;
	}
	let { activeTicketsCount, pendingInvitationsCount, upcomingRsvpsCount }: Props = $props();
</script>

<!-- Activity Summary Cards -->
{#if activeTicketsCount > 0 || pendingInvitationsCount > 0 || upcomingRsvpsCount > 0}
	<div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<!-- Active Tickets -->
		{#if activeTicketsCount > 0}
			<a
				href={resolve('/(auth)/dashboard/tickets', {})}
				class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-blue-100 p-3 dark:bg-blue-950">
							<Ticket class="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
						</div>
						<div>
							<p class="text-sm font-medium text-muted-foreground">
								{m['dashboard.activityCards.activeTickets']()}
							</p>
							<p class="text-3xl font-bold">{activeTicketsCount}</p>
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
			<a
				href={`${resolve('/(auth)/dashboard/rsvps', {})}?status=yes,maybe`}
				class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-green-100 p-3 dark:bg-green-950">
							<CheckCircle2 class="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
						</div>
						<div>
							<p class="text-sm font-medium text-muted-foreground">
								{m['dashboard.activityCards.upcomingRsvps']()}
							</p>
							<p class="text-3xl font-bold">{upcomingRsvpsCount}</p>
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
			<a
				href={resolve('/(auth)/dashboard/invitations', {})}
				class="group rounded-lg border bg-card p-6 transition-all hover:border-primary hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-purple-100 p-3 dark:bg-purple-950">
							<Mail class="h-6 w-6 text-purple-600 dark:text-purple-400" aria-hidden="true" />
						</div>
						<div>
							<p class="text-sm font-medium text-muted-foreground">
								{m['dashboard.activityCards.pendingInvitations']()}
							</p>
							<p class="text-3xl font-bold">{pendingInvitationsCount}</p>
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
