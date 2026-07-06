<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import type { EventDetailSchema } from '$lib/api/generated/types.gen';
	import {
		LogIn,
		ChevronDown,
		ChevronUp,
		UtensilsCrossed,
		Megaphone,
		Users,
		Salad
	} from '@lucide/svelte';

	interface Props {
		event: EventDetailSchema;
	}

	const { event }: Props = $props();

	// Collapsed by default — keep the card light; the value-prop list expands on click
	let isExpanded = $state(false);

	// Login link that returns the guest to this event page after signing in
	const loginHref = $derived(
		`/login?returnUrl=${encodeURIComponent($page.url.pathname + $page.url.search)}`
	);

	interface PerkItem {
		icon: typeof Megaphone;
		label: string;
		description: string;
	}

	// Sections that are gated behind authentication on this page. Potluck is only
	// listed when the event actually has it enabled, so the list stays accurate.
	const perks = $derived.by((): PerkItem[] => {
		const items: PerkItem[] = [];
		if (event.potluck_open) {
			items.push({
				icon: UtensilsCrossed,
				label: m['eventGuestPrompt.item_potluck'](),
				description: m['eventGuestPrompt.item_potluckDesc']()
			});
		}
		items.push(
			{
				icon: Megaphone,
				label: m['eventGuestPrompt.item_announcements'](),
				description: m['eventGuestPrompt.item_announcementsDesc']()
			},
			{
				icon: Users,
				label: m['eventGuestPrompt.item_attendees'](),
				description: m['eventGuestPrompt.item_attendeesDesc']()
			},
			{
				icon: Salad,
				label: m['eventGuestPrompt.item_dietary'](),
				description: m['eventGuestPrompt.item_dietaryDesc']()
			}
		);
		return items;
	});
</script>

<section
	class="rounded-lg border border-primary/30 bg-primary/5 p-4 sm:p-5"
	aria-labelledby="guest-signin-heading"
>
	<div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-start gap-3">
			<LogIn class="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
			<div>
				<h2 id="guest-signin-heading" class="font-semibold">
					{m['eventGuestPrompt.title']()}
				</h2>
				<p class="mt-1 text-sm text-muted-foreground">{m['eventGuestPrompt.subtitle']()}</p>
			</div>
		</div>
		<a
			href={loginHref}
			class="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			{m['eventGuestPrompt.cta']()}
		</a>
	</div>

	<!-- Collapsible list of what signing in unlocks -->
	<button
		type="button"
		onclick={() => (isExpanded = !isExpanded)}
		aria-expanded={isExpanded}
		aria-controls="guest-signin-perks"
		class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
	>
		{#if isExpanded}
			<ChevronUp class="h-4 w-4" aria-hidden="true" />
		{:else}
			<ChevronDown class="h-4 w-4" aria-hidden="true" />
		{/if}
		{m['eventGuestPrompt.expandLabel']()}
	</button>

	{#if isExpanded}
		<ul id="guest-signin-perks" class="mt-3 space-y-3">
			{#each perks as perk (perk.label)}
				{@const Icon = perk.icon}
				<li class="flex items-start gap-3">
					<Icon class="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
					<div class="text-sm">
						<p class="font-medium">{perk.label}</p>
						<p class="text-muted-foreground">{perk.description}</p>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
