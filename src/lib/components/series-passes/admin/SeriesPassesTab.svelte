<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventInListSchema, SeriesPassSchema } from '$lib/api/generated/types.gen';
	import { seriespassListSeriesPasses, seriespassadminDeleteSeriesPass } from '$lib/api';
	import { seriesPassQueryKeys, invalidateAdminPasses } from '$lib/queries/series-passes';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import SeriesPassForm from './SeriesPassForm.svelte';
	import SeriesPassHoldersDialog from './SeriesPassHoldersDialog.svelte';
	import { formatPrice } from '$lib/utils/format';
	import { formatDateTime } from '$lib/utils/date';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { Plus, Users, Pencil, Trash2, Loader2, Ticket } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		seriesId: string;
		organizationSlug: string;
		accessToken: string | null;
		canEdit: boolean;
		/** Upcoming, non-template occurrences — coverage candidates for new passes. */
		upcomingEvents: EventInListSchema[];
	}

	const { seriesId, organizationSlug, accessToken, canEdit, upcomingEvents }: Props = $props();

	const queryClient = useQueryClient();

	// NOTE: staff see all active passes (incl. private/staff-only) on the public
	// list endpoint. Once the admin list endpoint (with coverage/tier links)
	// lands, this switches to it — see letsrevel/revel-backend#644.
	const passesQuery = createQuery(() => ({
		queryKey: seriesPassQueryKeys.list(seriesId),
		queryFn: async () => {
			const response = await seriespassListSeriesPasses({
				path: { series_id: seriesId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) {
				throw new Error('Failed to load series passes');
			}
			return response.data;
		},
		enabled: !!accessToken
	}));

	const passes = $derived(passesQuery.data ?? []);

	let showCreateForm = $state(false);
	let passToEdit = $state<SeriesPassSchema | null>(null);
	let passForHolders = $state<SeriesPassSchema | null>(null);
	let passToDelete = $state<SeriesPassSchema | null>(null);

	const deleteMutation = createMutation(() => ({
		mutationFn: async (passId: string) => {
			const response = await seriespassadminDeleteSeriesPass({
				path: { series_id: seriesId, pass_id: passId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				throw new Error(extractErrorMessage(response.error, m['seriesPassAdmin.deleteFailed']()));
			}
			return response.data;
		},
		onSuccess: async () => {
			await invalidateAdminPasses(queryClient, seriesId);
			toast.success(m['seriesPassAdmin.deleteSuccess']());
			passToDelete = null;
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : m['seriesPassAdmin.deleteFailed']());
			passToDelete = null;
		}
	}));

	function paymentMethodLabel(method: string): string {
		switch (method) {
			case 'online':
				return m['seriesPassAdmin.paymentOnline']();
			case 'offline':
				return m['seriesPassAdmin.paymentOffline']();
			case 'free':
				return m['seriesPassAdmin.paymentFree']();
			default:
				return method;
		}
	}
</script>

<section aria-labelledby="passes-heading" class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 id="passes-heading" class="text-lg font-semibold">
				{m['seriesPassAdmin.tabHeading']()}
			</h2>
			<p class="text-sm text-muted-foreground">{m['seriesPassAdmin.tabDescription']()}</p>
		</div>
		{#if canEdit}
			<Button onclick={() => (showCreateForm = true)}>
				<Plus class="mr-1.5 h-4 w-4" aria-hidden="true" />
				{m['seriesPassAdmin.newPassButton']()}
			</Button>
		{/if}
	</div>

	{#if passesQuery.isLoading}
		<div class="flex items-center justify-center py-10" role="status">
			<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
			<span class="sr-only">{m['seriesPass.loading']()}</span>
		</div>
	{:else if passes.length === 0}
		<div class="rounded-md border border-dashed p-8 text-center">
			<Ticket class="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
			<h3 class="mb-1 font-medium">{m['seriesPassAdmin.emptyTitle']()}</h3>
			<p class="text-sm text-muted-foreground">{m['seriesPassAdmin.emptyDescription']()}</p>
		</div>
	{:else}
		<ul class="space-y-3">
			{#each passes as pass (pass.id)}
				<li class="rounded-lg border bg-card p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<h3 class="font-semibold">{pass.name}</h3>
							<dl class="mt-1 space-y-0.5 text-sm text-muted-foreground">
								<div>
									<span class="font-medium">{m['seriesPassAdmin.priceLabel']()}:</span>
									{formatPrice(pass.price, pass.currency, m['seriesPass.free']())}
									· {m['seriesPassAdmin.proRataShort']({
										amount: formatPrice(
											pass.pro_rata_discount,
											pass.currency,
											formatPrice(0, pass.currency, '—')
										)
									})}
								</div>
								<div>
									<span class="font-medium">{m['seriesPassAdmin.paymentMethodLabel']()}:</span>
									{paymentMethodLabel(pass.payment_method)}
								</div>
								{#if pass.sales_start_at || pass.sales_end_at}
									<div>
										<span class="font-medium">{m['seriesPassAdmin.salesWindowLabel']()}:</span>
										{pass.sales_start_at ? formatDateTime(pass.sales_start_at) : '—'}
										→ {pass.sales_end_at ? formatDateTime(pass.sales_end_at) : '—'}
									</div>
								{/if}
							</dl>
						</div>

						{#if canEdit}
							<div class="flex flex-wrap gap-2">
								<Button size="sm" variant="outline" onclick={() => (passForHolders = pass)}>
									<Users class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
									{m['seriesPassAdmin.holdersButton']()}
								</Button>
								<Button size="sm" variant="outline" onclick={() => (passToEdit = pass)}>
									<Pencil class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
									{m['seriesPassAdmin.editButton']()}
								</Button>
								<Button
									size="sm"
									variant="outline"
									class="text-destructive hover:bg-destructive hover:text-destructive-foreground"
									onclick={() => (passToDelete = pass)}
								>
									<Trash2 class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
									{m['seriesPassAdmin.deleteButton']()}
								</Button>
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if showCreateForm}
	<SeriesPassForm
		{seriesId}
		{organizationSlug}
		{accessToken}
		{upcomingEvents}
		onClose={() => (showCreateForm = false)}
	/>
{/if}

{#if passToEdit}
	<SeriesPassForm
		{seriesId}
		{organizationSlug}
		{accessToken}
		pass={passToEdit}
		{upcomingEvents}
		onClose={() => (passToEdit = null)}
	/>
{/if}

{#if passForHolders}
	<SeriesPassHoldersDialog
		{seriesId}
		pass={passForHolders}
		{accessToken}
		onClose={() => (passForHolders = null)}
	/>
{/if}

<ConfirmDialog
	isOpen={!!passToDelete}
	title={m['seriesPassAdmin.deleteTitle']()}
	message={m['seriesPassAdmin.deleteMessage']({ name: passToDelete?.name ?? '' })}
	confirmText={m['seriesPassAdmin.deleteConfirm']()}
	cancelText={m['seriesPass.cancelButton']()}
	variant="danger"
	onConfirm={() => passToDelete?.id && deleteMutation.mutate(passToDelete.id)}
	onCancel={() => (passToDelete = null)}
/>
