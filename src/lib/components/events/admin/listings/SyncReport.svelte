<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertCircle, Info } from '@lucide/svelte';
	import type { SyncReportEntry } from '$lib/api/generated/types.gen';
	import { integrationErrorMessage } from '$lib/utils/integration-errors';
	import { groupReport } from './listing-view';

	interface Props {
		/** The last attempt's entries (the backend replaces the report wholesale). */
		report: SyncReportEntry[];
		platform: string;
		/** Unique per card so the three group headings get distinct ids. */
		idPrefix: string;
	}
	const { report, platform, idPrefix }: Props = $props();

	const grouped = $derived(groupReport(report));

	function line(entry: SyncReportEntry): string {
		return (
			integrationErrorMessage(entry.code, platform, 'action', entry.tier_name ?? '') ?? entry.detail
		);
	}
</script>

{#snippet entries(list: SyncReportEntry[], showTier: boolean)}
	<ul class="space-y-1.5 text-sm text-foreground">
		{#each list as entry, i (`${entry.scope}-${entry.code}-${entry.tier_id ?? entry.tier_name ?? i}`)}
			<li>
				{#if showTier && entry.tier_name && entry.code !== 'remote_only_tier'}
					<span class="font-medium">{entry.tier_name}</span>
					<span aria-hidden="true"> · </span>
				{/if}
				<span>{line(entry)}</span>
				{#if entry.provider_message}
					<details class="mt-0.5 text-xs text-muted-foreground">
						<summary class="cursor-pointer"
							>{m['listings.report.detailsFromPlatform']({ platform })}</summary
						>
						<p class="mt-1 break-words">{entry.provider_message}</p>
					</details>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<div class="space-y-3">
	{#if grouped.problems.length > 0}
		<section
			class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3"
			aria-labelledby={`${idPrefix}-problems`}
		>
			<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
			<div class="min-w-0 flex-1">
				<h4 id={`${idPrefix}-problems`} class="text-sm font-bold text-foreground">
					{m['listings.report.problems']()}
				</h4>
				<div class="mt-1">{@render entries(grouped.problems, true)}</div>
			</div>
		</section>
	{/if}

	{#if grouped.skipped.length > 0}
		<section
			class="rounded-lg border border-border bg-muted p-3"
			aria-labelledby={`${idPrefix}-skipped`}
		>
			<h4 id={`${idPrefix}-skipped`} class="text-sm font-bold text-foreground">
				{m['listings.report.skipped']({ platform })}
			</h4>
			<div class="mt-1">{@render entries(grouped.skipped, true)}</div>
		</section>
	{/if}

	{#if grouped.notes.length > 0}
		<section
			class="flex items-start gap-2 rounded-lg border border-border bg-muted p-3"
			aria-labelledby={`${idPrefix}-notes`}
		>
			<Info class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<div class="min-w-0 flex-1">
				<h4 id={`${idPrefix}-notes`} class="text-sm font-bold text-foreground">
					{m['listings.report.notes']()}
				</h4>
				<div class="mt-1">{@render entries(grouped.notes, false)}</div>
			</div>
		</section>
	{/if}
</div>
