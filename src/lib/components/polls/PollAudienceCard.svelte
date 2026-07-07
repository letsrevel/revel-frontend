<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import Users from '@lucide/svelte/icons/users';
	import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
	import type {
		ResourceVisibility,
		EventInListSchema,
		MembershipTierSchema
	} from '$lib/api/generated/types.gen';

	interface Props {
		voteVisibility: ResourceVisibility;
		resultVisibility: ResourceVisibility;
		eventId: string | null;
		voteTierIds: string[];
		resultTierIds: string[];
		events: EventInListSchema[];
		tiers: MembershipTierSchema[];
	}

	let {
		voteVisibility = $bindable(),
		resultVisibility = $bindable(),
		eventId = $bindable(),
		voteTierIds = $bindable(),
		resultTierIds = $bindable(),
		events,
		tiers
	}: Props = $props();

	const visibilityOptions: { value: ResourceVisibility; label: string }[] = [
		{ value: 'public', label: m['pollCard.badge_public']() },
		{ value: 'unlisted', label: m['pollCard.badge_unlisted']() },
		{ value: 'private', label: m['pollCard.badge_private']() },
		{ value: 'members-only', label: m['pollCard.badge_members']() },
		{ value: 'staff-only', label: m['pollCard.badge_staff']() },
		{ value: 'attendees-only', label: m['pollCard.badge_attendees']() }
	];

	const showVoteTiers = $derived(voteVisibility === 'members-only');
	const showResultTiers = $derived(resultVisibility === 'members-only');
	const eventRequired = $derived(
		voteVisibility === 'private' ||
			voteVisibility === 'attendees-only' ||
			resultVisibility === 'private' ||
			resultVisibility === 'attendees-only'
	);

	function toggleTier(arr: string[], id: string): string[] {
		return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>{m['pollNewPage.audienceTitle']()}</CardTitle>
		<CardDescription>{m['pollNewPage.audienceDescription']()}</CardDescription>
	</CardHeader>
	<CardContent class="space-y-4">
		<div class="space-y-2">
			<Label for="vote-visibility">{m['pollNewPage.voteVisibilityLabel']()}</Label>
			<Select
				type="single"
				value={voteVisibility}
				onValueChange={(v) => {
					if (v) voteVisibility = v as ResourceVisibility;
				}}
			>
				<SelectTrigger id="vote-visibility"
					>{visibilityOptions.find((o) => o.value === voteVisibility)?.label}</SelectTrigger
				>
				<SelectContent>
					{#each visibilityOptions as opt (opt.value)}
						<SelectItem value={opt.value} label={opt.label}>{opt.label}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>

		<div class="space-y-2">
			<Label for="result-visibility">{m['pollNewPage.resultVisibilityLabel']()}</Label>
			<Select
				type="single"
				value={resultVisibility}
				onValueChange={(v) => {
					if (v) resultVisibility = v as ResourceVisibility;
				}}
			>
				<SelectTrigger id="result-visibility"
					>{visibilityOptions.find((o) => o.value === resultVisibility)?.label}</SelectTrigger
				>
				<SelectContent>
					{#each visibilityOptions as opt (opt.value)}
						<SelectItem value={opt.value} label={opt.label}>{opt.label}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>

		<div class="space-y-2">
			<Label for="event">{m['pollNewPage.eventLabel']()}</Label>
			<Select
				type="single"
				value={eventId ?? ''}
				onValueChange={(v) => {
					eventId = v || null;
				}}
			>
				<SelectTrigger id="event">
					{events.find((e) => e.id === eventId)?.name ?? m['pollNewPage.eventPlaceholder']()}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="" label={m['pollNewPage.eventPlaceholder']()}>
						{m['pollNewPage.eventPlaceholder']()}
					</SelectItem>
					{#each events as ev (ev.id)}
						<SelectItem value={ev.id} label={ev.name}>{ev.name}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
			{#if eventRequired}
				<p class="text-xs text-muted-foreground">{m['pollNewPage.eventRequiredHint']()}</p>
			{/if}
		</div>

		{#if showVoteTiers || showResultTiers}
			<!--
				Tier scoping section. When both vote_visibility and
				result_visibility are members-only, both pickers render — group
				them under a shared subheading and use the same icons that
				PollPrivacySummary uses for vote (Users) vs results (BarChart3)
				so the visual language stays consistent across surfaces.
			-->
			<div class="space-y-3 rounded-md border border-dashed p-3">
				<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{m['pollNewPage.tiersSectionTitle']()}
				</p>

				{#if showVoteTiers}
					<fieldset class="space-y-2">
						<legend class="flex items-center gap-2 px-1 text-sm font-medium">
							<Users class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							{m['pollNewPage.voteTiersLabel']()}
						</legend>
						{#each tiers as tier (tier.id)}
							{#if tier.id}
								{@const tierId = tier.id}
								<label class="flex items-center gap-2 pl-6 text-sm">
									<input
										type="checkbox"
										checked={voteTierIds.includes(tierId)}
										onchange={() => (voteTierIds = toggleTier(voteTierIds, tierId))}
										class="h-4 w-4"
									/>
									{tier.name}
								</label>
							{/if}
						{/each}
					</fieldset>
				{/if}

				{#if showResultTiers}
					<fieldset class="space-y-2">
						<legend class="flex items-center gap-2 px-1 text-sm font-medium">
							<BarChart3 class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
							{m['pollNewPage.resultTiersLabel']()}
						</legend>
						{#each tiers as tier (tier.id)}
							{#if tier.id}
								{@const tierId = tier.id}
								<label class="flex items-center gap-2 pl-6 text-sm">
									<input
										type="checkbox"
										checked={resultTierIds.includes(tierId)}
										onchange={() => (resultTierIds = toggleTier(resultTierIds, tierId))}
										class="h-4 w-4"
									/>
									{tier.name}
								</label>
							{/if}
						{/each}
					</fieldset>
				{/if}

				<p class="text-xs text-muted-foreground">{m['pollNewPage.tiersHint']()}</p>
			</div>
		{/if}
	</CardContent>
</Card>
