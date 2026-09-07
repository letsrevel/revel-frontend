<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { AlertCircle, Loader2, Pause, Play } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type {
		EventLinkSchema,
		TicketTierDetailSchema,
		TierLinkSchema,
		TierPauseFailureSchema
	} from '$lib/api/generated/types.gen';
	import { eventintegrationsPause, eventintegrationsResume } from '$lib/api/generated/sdk.gen';
	import { formatRelativeTime } from '$lib/utils/date';
	import {
		integrationErrorFromResponse,
		integrationErrorMessage,
		isIntegrationErrorInfo,
		silentIntegrationError,
		type IntegrationErrorInfo
	} from '$lib/utils/integration-errors';

	interface Props {
		eventId: string;
		provider: string;
		platform: string;
		link: EventLinkSchema;
		/** The event's Revel tiers, joined by id for `sales_paused`. */
		tiers: Pick<TicketTierDetailSchema, 'id' | 'sales_paused'>[];
		/** The tab re-fetches the listings (and tiers) after any change. */
		onChanged: () => void;
	}
	const { eventId, provider, platform, link, tiers, onChanged }: Props = $props();

	const headingId = $derived(`listing-${provider}-tiers`);
	const rows = $derived(link.tiers);

	function revelPaused(row: TierLinkSchema): boolean {
		return tiers.find((t) => t.id === row.tier_id)?.sales_paused === true;
	}
	// A tier paused on Revel is hidden on the platform whatever `remote_paused`
	// says (the mapper hides it on every push, and resume will not un-hide it),
	// so the state column and the bulk action treat it as paused.
	function effectivelyPaused(row: TierLinkSchema): boolean {
		return row.remote_paused || revelPaused(row);
	}
	const allPaused = $derived(rows.length > 0 && rows.every(effectivelyPaused));
	// "Resume all" only when something would actually come back on sale.
	const anyResumable = $derived(rows.some((r) => r.remote_paused && !revelPaused(r)));

	// Per-tier failures from the last pause/resume, keyed by tier id, reset
	// when the next attempt starts; the backend answers 200 even when some
	// tiers fail.
	let failures = $state<Record<string, TierPauseFailureSchema>>({});
	let actionError = $state<IntegrationErrorInfo | null>(null);
	let busyTier = $state<string | 'all' | null>(null);

	// Synchronous on the backend by design: a kill switch must not say
	// "pending". The response carries the refreshed link, but the tab's
	// re-fetch is what re-renders every card, so only `failed` is read here.
	const toggle = createMutation(() => ({
		mutationFn: async (input: { tierId: string | null; paused: boolean }) => {
			busyTier = input.tierId ?? 'all';
			const call = input.paused ? eventintegrationsPause : eventintegrationsResume;
			const res = await call({
				path: { event_id: eventId, provider },
				...(input.tierId ? { body: { tier_id: input.tierId } } : {})
			});
			if (res.error || !res.data) throw silentIntegrationError(res.error, platform);
			return res.data;
		},
		onSuccess: (result) => {
			failures = Object.fromEntries(result.failed.map((f) => [f.tier_id, f]));
			busyTier = null;
			onChanged();
		},
		onError: (err: unknown) => {
			busyTier = null;
			actionError = isIntegrationErrorInfo(err) ? err : integrationErrorFromResponse(err, platform);
		}
	}));

	function run(tierId: string | null, paused: boolean) {
		actionError = null;
		failures = {};
		toggle.mutate({ tierId, paused });
	}

	function failureLine(f: TierPauseFailureSchema): string {
		return integrationErrorMessage(f.code, platform) ?? f.detail;
	}
</script>

<section class="space-y-3" aria-labelledby={headingId}>
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h4 id={headingId} class="text-sm font-bold text-foreground">
			{m['listings.tiers.heading']()}
		</h4>
		{#if rows.length > 1}
			<Button
				variant="outline"
				size="sm"
				onclick={() => run(null, !allPaused)}
				disabled={!browser || toggle.isPending || (allPaused && !anyResumable)}
				class="inline-flex items-center gap-2"
			>
				{#if busyTier === 'all'}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{:else if allPaused}
					<Play class="h-4 w-4" aria-hidden="true" />
				{:else}
					<Pause class="h-4 w-4" aria-hidden="true" />
				{/if}
				{allPaused
					? m['listings.tiers.resumeAll']({ platform })
					: m['listings.tiers.pauseAll']({ platform })}
			</Button>
		{/if}
	</div>

	{#if actionError}
		<div
			class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3"
			role="alert"
		>
			<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
			<p class="text-sm text-foreground">{actionError.message}</p>
		</div>
	{/if}

	<!-- One DOM for every viewport: below `md` the header row is hidden and each
	     cell stacks as a block with its own small label, so phones get a card per
	     ticket without a second copy of the buttons. -->
	<div class="overflow-x-auto rounded-lg border border-border">
		<table class="w-full text-sm">
			<thead class="hidden bg-muted/50 md:table-header-group">
				<tr>
					<th
						class="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
						>{m['listings.tiers.column.ticket']()}</th
					>
					<th
						class="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
						>{m['listings.tiers.column.sold']({ platform })}</th
					>
					<th
						class="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
						>{m['listings.tiers.column.state']({ platform })}</th
					>
					<th class="px-3 py-2"><span class="sr-only">{m['listings.tiers.heading']()}</span></th>
				</tr>
			</thead>
			<tbody class="block md:table-row-group">
				{#each rows as row (row.tier_id)}
					{@const paused = effectivelyPaused(row)}
					{@const hiddenByRevel = revelPaused(row)}
					{@const failure = failures[row.tier_id]}
					{@const action = paused ? m['listings.tiers.resume']() : m['listings.tiers.pause']()}
					<tr class="block border-t border-border p-3 md:table-row md:p-0 md:align-top">
						<td class="block py-1 font-medium text-foreground md:table-cell md:px-3 md:py-2">
							{row.tier_name}
						</td>
						<td
							class="block py-1 text-foreground md:table-cell md:whitespace-nowrap md:px-3 md:py-2"
						>
							<span class="mr-2 text-xs uppercase tracking-[0.12em] text-muted-foreground md:hidden"
								>{m['listings.tiers.column.sold']({ platform })}</span
							>
							{row.remote_quantity_sold}
							<span class="block text-xs text-muted-foreground">
								{row.counts_updated_at
									? m['listings.tiers.updated']({ when: formatRelativeTime(row.counts_updated_at) })
									: m['listings.tiers.notYet']()}
							</span>
						</td>
						<td class="block py-1 md:table-cell md:px-3 md:py-2">
							<span class="mr-2 text-xs uppercase tracking-[0.12em] text-muted-foreground md:hidden"
								>{m['listings.tiers.column.state']({ platform })}</span
							>
							<StatusBadge
								tone={paused ? 'warning' : 'neutral'}
								label={paused ? m['listings.tiers.paused']() : m['listings.tiers.onSale']()}
								size="sm"
							/>
							{#if hiddenByRevel}
								<p class="mt-1 text-xs text-muted-foreground">
									{m['listings.tiers.hiddenByRevel']({ platform })}
								</p>
							{/if}
							{#if failure}
								<p class="mt-1 text-xs text-foreground" role="alert">
									{failureLine(failure)}
									{#if failure.provider_message}
										<span class="block text-muted-foreground">{failure.provider_message}</span>
									{/if}
								</p>
							{/if}
						</td>
						<td class="block py-1 md:table-cell md:whitespace-nowrap md:px-3 md:py-2 md:text-right">
							<Button
								variant="ghost"
								size="sm"
								onclick={() => run(row.tier_id, !paused)}
								disabled={!browser || toggle.isPending || hiddenByRevel}
								aria-label={m['listings.tiers.rowAction']({
									action,
									ticket: row.tier_name,
									platform
								})}
								class="inline-flex items-center gap-1.5"
							>
								{#if busyTier === row.tier_id}
									<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
								{:else if paused}
									<Play class="h-4 w-4" aria-hidden="true" />
								{:else}
									<Pause class="h-4 w-4" aria-hidden="true" />
								{/if}
								{action}
							</Button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="text-xs text-muted-foreground">{m['listings.tiers.promoNote']({ platform })}</p>
</section>
