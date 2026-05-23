<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
	import Eye from '@lucide/svelte/icons/eye';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Users from '@lucide/svelte/icons/users';
	import type { PollResultTiming, ResourceVisibility } from '$lib/api/generated/types.gen';

	interface Props {
		voteVisibility: ResourceVisibility;
		resultVisibility: ResourceVisibility;
		resultTiming: PollResultTiming;
		staffAnonymous: boolean;
		publicAnonymous: boolean;
		allowVoteChanges: boolean;
	}

	const {
		voteVisibility,
		resultVisibility,
		resultTiming,
		staffAnonymous,
		publicAnonymous,
		allowVoteChanges
	}: Props = $props();

	function visibilityLabel(v: ResourceVisibility): string {
		switch (v) {
			case 'public':
				return m['pollPrivacy.audience_public']();
			case 'unlisted':
				return m['pollPrivacy.audience_unlisted']();
			case 'private':
				return m['pollPrivacy.audience_invited']();
			case 'members-only':
				return m['pollPrivacy.audience_members']();
			case 'staff-only':
				return m['pollPrivacy.audience_staff']();
			case 'attendees-only':
				return m['pollPrivacy.audience_attendees']();
		}
	}

	function timingLabel(t: PollResultTiming): string {
		switch (t) {
			case 'never':
				return m['pollPrivacy.timing_never']();
			case 'after_vote':
				return m['pollPrivacy.timing_afterVote']();
			case 'after_close':
				return m['pollPrivacy.timing_afterClose']();
		}
	}

	// Skip the results row when staff-only/never — results aren't shared with voters at all.
	const showResultsRow = $derived(!(resultVisibility === 'staff-only' && resultTiming === 'never'));

	// Skip voter-anonymity row when only staff can see results — other voters see nothing.
	const showVoterAnonymityRow = $derived(resultVisibility !== 'staff-only');
</script>

<section class="space-y-2 rounded-lg border bg-card/50 p-4">
	<!-- Who can vote -->
	<div class="flex items-center gap-2 text-sm">
		<Users class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
		<span>{m['pollPrivacy.canVote']({ audience: visibilityLabel(voteVisibility) })}</span>
	</div>

	<!-- Who sees results + when -->
	{#if showResultsRow}
		<div class="flex items-center gap-2 text-sm">
			<BarChart3 class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<span>
				{m['pollPrivacy.canSeeResults']({
					audience: visibilityLabel(resultVisibility),
					when: timingLabel(resultTiming)
				})}
			</span>
		</div>
	{/if}

	<!-- Anonymity to other voters -->
	{#if showVoterAnonymityRow}
		{#if publicAnonymous}
			<div class="flex items-center gap-2 text-sm">
				<Eye class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				<span>{m['pollPrivacy.anonymousToVoters']()}</span>
			</div>
		{:else}
			<div
				class="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
				role="note"
			>
				<AlertTriangle class="h-4 w-4 shrink-0" aria-hidden="true" />
				<span>{m['pollPrivacy.identityVisibleToVoters']()}</span>
			</div>
		{/if}
	{/if}

	<!-- Anonymity to staff — only shown when staff can see voter identity -->
	{#if !staffAnonymous}
		<div
			class="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
			role="note"
		>
			<AlertTriangle class="h-4 w-4 shrink-0" aria-hidden="true" />
			<span>{m['pollPrivacy.identityVisibleToStaff']()}</span>
		</div>
	{/if}

	<!-- Vote changes -->
	{#if allowVoteChanges}
		<div class="flex items-center gap-2 text-sm">
			<RotateCcw class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<span>{m['pollPrivacy.allowsChanges']()}</span>
		</div>
	{/if}
</section>
