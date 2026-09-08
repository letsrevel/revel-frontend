<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages.js';
	import { formatEventDate } from '$lib/utils/date';
	import EventStatusBadge from '$lib/components/events/EventStatusBadge.svelte';
	import { Ticket, ChevronRight, Users } from '@lucide/svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';

	const { data }: { data: PageData } = $props();

	const slug = $derived(data.organization.slug);
	const events = $derived(data.events);
</script>

<svelte:head>
	<title>{m['orgAdmin.tickets.title']()} · {data.organization.name}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="space-y-6">
	<PageHeader title={m['orgAdmin.tickets.title']()} subtitle={m['orgAdmin.tickets.subtitle']()} />

	{#if events.length === 0}
		{#snippet goToEventsAction()}
			<Button href={resolve('/(auth)/org/[slug]/admin/events', { slug: slug })}>
				{m['orgAdmin.tickets.empty.cta']()}
			</Button>
		{/snippet}
		<EmptyState
			icon={Ticket}
			level={2}
			title={m['orgAdmin.tickets.empty.title']()}
			body={m['orgAdmin.tickets.empty.description']()}
			action={goToEventsAction}
		/>
	{:else}
		<ul class="space-y-3">
			{#each events as event (event.id)}
				<li>
					<a
						href={resolve('/(auth)/org/[slug]/admin/events/[event_id]/tickets', {
							slug: slug,
							event_id: event.id
						})}
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
								<span class="truncate font-bold">{event.name}</span>
								<EventStatusBadge {event} />
							</div>
							<div
								class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
							>
								<span>{formatEventDate(event.start, event.timezone)}</span>
								<!-- Staff see the real numbers, but the field is nullable since
								     #825 — omit the tally rather than render a fabricated zero. -->
								{#if event.attendee_count != null}
									<span class="inline-flex items-center gap-1">
										<Users class="h-3.5 w-3.5" aria-hidden="true" />
										{m['orgAdmin.tickets.attendees']({ count: event.attendee_count })}
									</span>
								{/if}
							</div>
						</div>

						<ChevronRight class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
