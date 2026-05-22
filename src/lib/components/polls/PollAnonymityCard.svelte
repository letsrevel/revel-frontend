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
	import Lock from '@lucide/svelte/icons/lock';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui/select';
	import { resultVisibilityRequiresPublicAnonymous } from '$lib/utils/polls';
	import type { PollResultTiming, ResourceVisibility } from '$lib/api/generated/types.gen';

	interface Props {
		resultTiming: PollResultTiming;
		staffAnonymous: boolean;
		publicAnonymous: boolean;
		allowVoteChanges: boolean;
		resultVisibility: ResourceVisibility;
		/** 'create' allows editing anonymity flags. 'edit' locks them. */
		mode: 'create' | 'edit';
	}

	let {
		resultTiming = $bindable(),
		staffAnonymous = $bindable(),
		publicAnonymous = $bindable(),
		allowVoteChanges = $bindable(),
		resultVisibility,
		mode
	}: Props = $props();

	// Auto-force public_anonymous when result visibility is PUBLIC/UNLISTED on create
	$effect(() => {
		if (mode === 'create' && resultVisibilityRequiresPublicAnonymous(resultVisibility)) {
			publicAnonymous = true;
		}
	});

	const publicAnonymousLocked = $derived(
		mode === 'edit' || resultVisibilityRequiresPublicAnonymous(resultVisibility)
	);
	const staffAnonymousLocked = $derived(mode === 'edit');

	const timingOptions: { value: PollResultTiming; label: string }[] = [
		{ value: 'never', label: m['pollNewPage.resultTimingNever']() },
		{ value: 'after_vote', label: m['pollNewPage.resultTimingAfterVote']() },
		{ value: 'after_close', label: m['pollNewPage.resultTimingAfterClose']() }
	];
</script>

<Card>
	<CardHeader>
		<CardTitle>{m['pollNewPage.anonymityTitle']()}</CardTitle>
		<CardDescription>
			{#if mode === 'create'}
				⚠️ {m['pollNewPage.anonymityDescription']()}
			{:else}
				{m['pollEditPage.anonymityLockTooltip']()}
			{/if}
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-4">
		<div class="space-y-2">
			<Label for="result-timing">{m['pollNewPage.resultTimingLabel']()}</Label>
			<Select
				type="single"
				value={resultTiming}
				onValueChange={(v) => {
					if (v) resultTiming = v as PollResultTiming;
				}}
			>
				<SelectTrigger id="result-timing">
					{timingOptions.find((o) => o.value === resultTiming)?.label}
				</SelectTrigger>
				<SelectContent>
					{#each timingOptions as opt (opt.value)}
						<SelectItem value={opt.value} label={opt.label}>{opt.label}</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>

		<label class="flex items-center gap-2 text-sm">
			<input
				type="checkbox"
				bind:checked={staffAnonymous}
				disabled={staffAnonymousLocked}
				class="h-4 w-4"
			/>
			<span class="flex items-center gap-1">
				{m['pollNewPage.staffAnonymousLabel']()}
				{#if staffAnonymousLocked}
					<Lock class="h-3 w-3 text-muted-foreground" />
				{/if}
			</span>
		</label>

		<label class="flex items-center gap-2 text-sm">
			<input
				type="checkbox"
				bind:checked={publicAnonymous}
				disabled={publicAnonymousLocked}
				class="h-4 w-4"
			/>
			<span class="flex items-center gap-1">
				{m['pollNewPage.publicAnonymousLabel']()}
				{#if publicAnonymousLocked}
					<Lock class="h-3 w-3 text-muted-foreground" />
				{/if}
			</span>
		</label>
		{#if mode === 'create' && resultVisibilityRequiresPublicAnonymous(resultVisibility)}
			<p class="text-xs text-muted-foreground">{m['pollNewPage.publicAnonymousForced']()}</p>
		{/if}

		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={allowVoteChanges} class="h-4 w-4" />
			{m['pollNewPage.allowVoteChangesLabel']()}
		</label>
	</CardContent>
</Card>
