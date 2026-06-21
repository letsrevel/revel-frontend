<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages.js';
	import { formatEventDate } from '$lib/utils/date';
	import EventStatusBadge from '$lib/components/events/EventStatusBadge.svelte';
	import { Ticket, ChevronRight, Users } from 'lucide-svelte';

	const { data }: { data: PageData } = $props();

	const slug = $derived(data.organization.slug);
	const events = $derived(data.events);
</script>

<svelte:head>
	<title>{m['orgAdmin.tickets.title']()} · {data.organization.name}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="space-y-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight">{m['orgAdmin.tickets.title']()}</h1>
		<p class="mt-1 text-sm text-muted-foreground">{m['orgAdmin.tickets.subtitle']()}</p>
	</header>

	{#if events.length === 0}
		<div class="rounded-lg border border-border bg-card p-12 text-center">
			<Ticket class="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
			<h2 class="mt-4 text-lg font-semibold">{m['orgAdmin.tickets.empty.title']()}</h2>
			<p class="mt-2 text-sm text-muted-foreground">
				{m['orgAdmin.tickets.empty.description']()}
			</p>
			<a
				href="/org/{slug}/admin/events"
				class="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{m['orgAdmin.tickets.empty.cta']()}
			</a>
		</div>
	{:else}
		<ul class="space-y-3">
			{#each events as event (event.id)}
				<li>
					<a
						href="/org/{slug}/admin/events/{event.id}/tickets"
						class="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{#if event.logo_thumbnail_url}
							<img
								src={event.logo_thumbnail_url}
								alt=""
								class="h-12 w-12 shrink-0 rounded-md object-cover"
							/>
						{:else}
							<div
								class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted"
								aria-hidden="true"
							>
								<Ticket class="h-6 w-6 text-muted-foreground" />
							</div>
						{/if}

						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<span class="truncate font-semibold">{event.name}</span>
								<EventStatusBadge {event} />
							</div>
							<div
								class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
							>
								<span>{formatEventDate(event.start, event.timezone)}</span>
								<span class="inline-flex items-center gap-1">
									<Users class="h-3.5 w-3.5" aria-hidden="true" />
									{m['orgAdmin.tickets.attendees']({ count: event.attendee_count })}
								</span>
							</div>
						</div>

						<ChevronRight class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
