<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import AdminWarningList from '$lib/components/admin-warnings/AdminWarningList.svelte';
	import { compactWarnings, withFix } from '$lib/utils/admin-warnings/types';
	import {
		pollPublicResultsNeverShown,
		pollResultsVisibleToEveryone,
		pollVotableByEveryone
	} from '$lib/utils/admin-warnings/poll';

	/**
	 * Setting warnings for the poll audience and timing (#1314, G2).
	 * Uses the live form state, so it reacts while the organizer edits.
	 */
	interface Props {
		voteVisibility: string | null | undefined;
		resultVisibility: string | null | undefined;
		resultTiming: string | null | undefined;
		/** `draft` on the create page. */
		status: string | null | undefined;
		orgVisibility: string | null | undefined;
		/** Saved poll id. Unset on the create page (no dismiss buttons). */
		pollId?: string;
	}

	const { voteVisibility, resultVisibility, resultTiming, status, orgVisibility, pollId }: Props =
		$props();

	const warnings = $derived(
		compactWarnings([
			(() => {
				const w = pollPublicResultsNeverShown({
					result_visibility: resultVisibility,
					result_timing: resultTiming
				});
				return w && withFix(w, 'result-timing', () => m['adminWarnings.fixResultTiming']());
			})(),
			(() => {
				const w = pollResultsVisibleToEveryone({
					orgVisibility,
					result_visibility: resultVisibility,
					status
				});
				return w && withFix(w, 'result-visibility', () => m['adminWarnings.fixResultVisibility']());
			})(),
			(() => {
				const w = pollVotableByEveryone({ orgVisibility, vote_visibility: voteVisibility, status });
				return w && withFix(w, 'vote-visibility', () => m['adminWarnings.fixVoteVisibility']());
			})()
		])
	);
</script>

<AdminWarningList
	{warnings}
	entityId={pollId}
	fallbackFocusId="vote-visibility"
	label={m['adminWarnings.listLabel']()}
	testId="poll-warnings"
/>
