<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { summarizeAccess, capitalizeFirst } from '../access-summary';

	interface Props {
		visibility?: string | null;
		eventType?: string | null;
	}

	const { visibility, eventType }: Props = $props();

	/** Explanation for the current visibility + event_type combination. */
	const explanation = $derived(summarizeAccess(visibility, eventType));
</script>

<!-- Live "With these settings" readout under the visibility / event-type tiles. -->
<div class="rounded-md border border-info/40 bg-info/10 p-4" role="status" aria-live="polite">
	<div class="flex items-start gap-3">
		<div class="flex-shrink-0">
			<svg
				class="h-5 w-5 text-info"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		</div>
		<div class="flex-1">
			<h4 class="text-sm font-medium text-info">
				{m['essentialsStep.withTheseSettings']()}
			</h4>
			<div class="mt-2 space-y-1 text-sm text-foreground">
				<p>
					<strong>{m['essentialsStep.whoCanView']()}</strong>
					{explanation.viewDescription}
				</p>
				<p>
					<strong>{m['essentialsStep.whoCanAttend']()}</strong>
					{m['essentialsStep.whoCanAttendValue']({
						who: capitalizeFirst(explanation.whoCanAttend)
					})}
				</p>
				{#if explanation.showJoinOrgHint}
					<p class="mt-2 rounded-md bg-info/15 px-2 py-1.5 text-xs">
						💡 <strong>{m['essentialsStep.tip']()}</strong>
						{m['essentialsStep.joinOrgHint']()}
					</p>
				{/if}
			</div>
		</div>
	</div>
</div>
