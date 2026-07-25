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

	interface Props {
		organization: OrganizationAdminDetailSchema;
	}

	const { organization }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	const metricsQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'subscription-metrics'],
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
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: metrics.mrr_currency,
			minimumFractionDigits: 2
		}).format(Number(metrics.mrr));
	});

	const churnDisplay = $derived(metrics ? `${(metrics.churn_rate_30d * 100).toFixed(1)}%` : null);
</script>

{#if metrics}
	<div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
		<Card>
			<CardContent class="p-3">
				<p class="text-xs text-muted-foreground">
					{m['orgAdmin.members.subscriptions.metrics.mrr']()}
				</p>
				{#if metrics.mixed_currency_warning}
					<p class="flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-300">
						<TriangleAlert class="h-4 w-4 shrink-0" aria-hidden="true" />
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
{/if}
