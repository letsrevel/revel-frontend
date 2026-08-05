<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { organizationadminsubscriptionsGetSubscriptionMetrics } from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationAdminDetailSchema,
		SubscriptionMetricsSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { TriangleAlert } from '@lucide/svelte';
	import { formatMoney, formatPercent } from '$lib/utils/format';
	import {
		getStatusLabel,
		getStatusTone,
		STATUS_ORDER,
		type SubscriptionStatus
	} from '$lib/utils/subscriptions';
	import type { Tone } from '$lib/components/common/tones';

	interface Props {
		organization: OrganizationAdminDetailSchema;
	}

	const { organization }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	const metricsQuery = createQuery(() => ({
		// Nested under the 'subscriptions' prefix so every mutation that already
		// invalidates ['organization', slug, 'subscriptions'] refreshes the header too.
		queryKey: ['organization', organization.slug, 'subscriptions', 'metrics'],
		queryFn: async () => {
			const res = await organizationadminsubscriptionsGetSubscriptionMetrics({
				path: { slug: organization.slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load metrics');
			return res.data as SubscriptionMetricsSchema;
		},
		enabled: !!accessToken
	}));

	const metrics = $derived(metricsQuery.data);

	const mrrDisplay = $derived.by(() => {
		if (!metrics || metrics.mixed_currency_warning) return null;
		// The backend sends an empty currency when the org has no active
		// subscriptions — there is nothing to denominate, so show an em dash
		// rather than an arbitrary currency (and never hand '' to Intl, which
		// throws a RangeError).
		if (!metrics.mrr_currency) return '—';
		return formatMoney(metrics.mrr, metrics.mrr_currency);
	});

	const churnDisplay = $derived(metrics ? formatPercent(metrics.churn_rate_30d) : null);

	interface StatusChip {
		status: SubscriptionStatus;
		label: string;
		count: number;
		className: string;
	}

	// Solid tone fills, same audited token pairs as `common/StatusBadge`'s
	// `toneClasses` — duplicated rather than imported because the primitive
	// doesn't export its class map, and this chip's shape (label + count in one
	// pill) isn't the primitive's own. Every pair here is enforced >= 4.5:1 by
	// scripts/audit-brand-themes.py in both modes.
	const CHIP_TONE_CLASSES: Record<Tone, string> = {
		brand: 'bg-primary text-primary-foreground',
		info: 'bg-info text-info-foreground',
		success: 'bg-success text-success-foreground',
		warning: 'bg-highlight text-highlight-foreground',
		danger: 'bg-destructive text-destructive-foreground',
		neutral: 'bg-muted text-muted-foreground'
	};

	// Zero-count statuses are dropped, so a young org shows a short strip instead
	// of six "0" chips — and an org with no subscriptions at all shows nothing.
	const statusChips = $derived.by<StatusChip[]>(() => {
		const breakdown = metrics?.status_breakdown;
		if (!breakdown) return [];
		return STATUS_ORDER.filter((status) => (breakdown[status] ?? 0) > 0).map((status) => ({
			status,
			label: getStatusLabel(status),
			count: breakdown[status],
			className: CHIP_TONE_CLASSES[getStatusTone(status)]
		}));
	});
</script>

{#if metricsQuery.isError}
	<p class="text-sm text-muted-foreground">
		{m['orgAdmin.members.subscriptions.metrics.error']()}
	</p>
{:else if metrics}
	<div class="space-y-2">
		<div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
			<Card>
				<CardContent class="p-3">
					<p class="text-xs text-muted-foreground">
						{m['orgAdmin.members.subscriptions.metrics.mrr']()}
					</p>
					{#if metrics.mixed_currency_warning}
						<p class="flex items-center gap-1 text-sm font-medium text-foreground">
							<TriangleAlert
								class="h-4 w-4 shrink-0 text-highlight-foreground dark:text-highlight"
								aria-hidden="true"
							/>
							{m['orgAdmin.members.subscriptions.metrics.mixedCurrency']()}
						</p>
					{:else}
						<p class="text-lg font-semibold">{mrrDisplay}</p>
					{/if}
				</CardContent>
			</Card>
			<Card>
				<CardContent class="p-3">
					<p class="text-xs text-muted-foreground">
						{m['orgAdmin.members.subscriptions.metrics.active']()}
					</p>
					<p class="text-lg font-semibold">{metrics.active_count}</p>
					<!-- The backend's `active_count` is `active + past_due`
					     (`subscription_reporting._compute`), and the status strip right
					     below spells both out separately — so without this line the tile
					     reads as a third number that contradicts the two under it.
					     Unconditional: it defines the metric, so it must not appear only
					     when there happens to be a past-due row. -->
					<p class="text-xs text-muted-foreground">
						{m['orgAdmin.members.subscriptions.metrics.activeIncludesPastDue']()}
					</p>
				</CardContent>
			</Card>
			<Card>
				<CardContent class="p-3">
					<p class="text-xs text-muted-foreground">
						{m['orgAdmin.members.subscriptions.metrics.new30d']()}
					</p>
					<p class="text-lg font-semibold">{metrics.new_subscribers_30d}</p>
				</CardContent>
			</Card>
			<Card>
				<CardContent class="p-3">
					<p class="text-xs text-muted-foreground">
						{m['orgAdmin.members.subscriptions.metrics.churn30d']()}
					</p>
					<p class="text-lg font-semibold">
						{metrics.churned_30d}
						<span class="text-sm font-normal text-muted-foreground">({churnDisplay})</span>
					</p>
				</CardContent>
			</Card>
		</div>
		{#if statusChips.length > 0}
			<!-- Meaning is carried by the text ("Active 12"); the tint is decoration
			     layered on top of it, never the only signal. -->
			<div
				class="flex flex-wrap items-center gap-1.5"
				role="group"
				aria-label={m['orgAdmin.members.subscriptions.metrics.statusBreakdown']()}
			>
				{#each statusChips as chip (chip.status)}
					<span
						class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium {chip.className}"
					>
						<span>{chip.label}</span>
						<span class="font-semibold tabular-nums">{chip.count}</span>
					</span>
				{/each}
			</div>
		{/if}
	</div>
{/if}
