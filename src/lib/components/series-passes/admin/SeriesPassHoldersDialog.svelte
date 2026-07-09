<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { SeriesPassSchema, HeldSeriesPassAdminSchema } from '$lib/api/generated/types.gen';
	import {
		seriespassadminListSeriesPassHolders,
		seriespassadminConfirmSeriesPassPayment,
		seriespassadminCancelSeriesPass
	} from '$lib/api';
	import { seriesPassQueryKeys, invalidateAdminPasses } from '$lib/queries/series-passes';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import TicketStatusBadge from '$lib/components/tickets/TicketStatusBadge.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import SearchInput from '$lib/components/events/filters/SearchInput.svelte';
	import { formatPrice } from '$lib/utils/format';
	import { formatDate } from '$lib/utils/date';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		seriesId: string;
		pass: SeriesPassSchema;
		accessToken: string | null;
		onClose: () => void;
	}

	const { seriesId, pass, accessToken, onClose }: Props = $props();

	const queryClient = useQueryClient();
	const passId = $derived(pass.id ?? '');

	let debouncedSearch = $state('');
	let currentPage = $state(1);

	function handleSearch(value: string) {
		debouncedSearch = value;
		currentPage = 1;
	}

	const PAGE_SIZE = 20;

	const holdersQuery = createQuery(() => ({
		queryKey: seriesPassQueryKeys.holders(seriesId, passId, {
			page: currentPage,
			search: debouncedSearch
		}),
		queryFn: async () => {
			const response = await seriespassadminListSeriesPassHolders({
				path: { series_id: seriesId, pass_id: passId },
				query: {
					page: currentPage,
					page_size: PAGE_SIZE,
					search: debouncedSearch || undefined
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) {
				throw new Error('Failed to load pass holders');
			}
			return response.data;
		},
		enabled: !!accessToken && !!passId
	}));

	const holders = $derived(holdersQuery.data?.results ?? []);
	const totalCount = $derived(holdersQuery.data?.count ?? 0);
	const totalPages = $derived(Math.max(1, Math.ceil(totalCount / PAGE_SIZE)));

	// Confirm offline payment
	let holderToConfirm = $state<HeldSeriesPassAdminSchema | null>(null);

	const confirmPaymentMutation = createMutation(() => ({
		mutationFn: async (heldPassId: string) => {
			const response = await seriespassadminConfirmSeriesPassPayment({
				path: { series_id: seriesId, held_pass_id: heldPassId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				throw new Error(
					extractErrorMessage(response.error, m['seriesPassAdmin.confirmPaymentFailed']())
				);
			}
			return response.data;
		},
		onSuccess: async () => {
			await invalidateAdminPasses(queryClient, seriesId);
			toast.success(m['seriesPassAdmin.confirmPaymentSuccess']());
			holderToConfirm = null;
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : m['seriesPassAdmin.confirmPaymentFailed']()
			);
			holderToConfirm = null;
		}
	}));

	// Cancel a held pass (refunds remaining events server-side)
	let holderToCancel = $state<HeldSeriesPassAdminSchema | null>(null);
	let cancelReason = $state('');

	const cancelMutation = createMutation(() => ({
		mutationFn: async ({ heldPassId, reason }: { heldPassId: string; reason: string }) => {
			const response = await seriespassadminCancelSeriesPass({
				path: { series_id: seriesId, held_pass_id: heldPassId },
				body: { reason: reason.trim() || null },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				throw new Error(
					extractErrorMessage(response.error, m['seriesPassAdmin.cancelHolderFailed']())
				);
			}
			return response.data;
		},
		onSuccess: async () => {
			await invalidateAdminPasses(queryClient, seriesId);
			toast.success(m['seriesPassAdmin.cancelHolderSuccess']());
			holderToCancel = null;
			cancelReason = '';
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : m['seriesPassAdmin.cancelHolderFailed']()
			);
		}
	}));

	function holderName(holder: HeldSeriesPassAdminSchema): string {
		return holder.user.display_name;
	}

	const isOffline = $derived(pass.payment_method === 'offline');
</script>

<Dialog open onOpenChange={onClose}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
		<DialogHeader>
			<DialogTitle>{m['seriesPassAdmin.holdersTitle']({ name: pass.name })}</DialogTitle>
			<DialogDescription>
				{m['seriesPassAdmin.holdersDescription']({ count: totalCount })}
			</DialogDescription>
		</DialogHeader>

		<!-- Search (SearchInput debounces internally) -->
		<SearchInput
			value={debouncedSearch}
			onSearch={handleSearch}
			placeholder={m['seriesPassAdmin.holdersSearchPlaceholder']()}
			ariaLabel={m['seriesPassAdmin.holdersSearchPlaceholder']()}
		/>

		{#if holdersQuery.isLoading}
			<div class="flex items-center justify-center py-8" role="status">
				<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
				<span class="sr-only">{m['seriesPass.loading']()}</span>
			</div>
		{:else if holders.length === 0}
			<p class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
				{m['seriesPassAdmin.noHolders']()}
			</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b text-left text-xs uppercase text-muted-foreground">
							<th scope="col" class="px-2 py-2">{m['seriesPassAdmin.holderColumn']()}</th>
							<th scope="col" class="px-2 py-2">{m['seriesPassAdmin.statusColumn']()}</th>
							<th scope="col" class="px-2 py-2">{m['seriesPassAdmin.pricePaidColumn']()}</th>
							<th scope="col" class="px-2 py-2">{m['seriesPassAdmin.purchasedColumn']()}</th>
							<th scope="col" class="px-2 py-2">
								<span class="sr-only">{m['seriesPassAdmin.actionsColumn']()}</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{#each holders as holder (holder.id)}
							<tr class="border-b last:border-0">
								<td class="px-2 py-3">
									<div class="font-medium">{holderName(holder)}</div>
									{#if holder.user.email}
										<div class="text-xs text-muted-foreground">{holder.user.email}</div>
									{/if}
								</td>
								<td class="px-2 py-3">
									<TicketStatusBadge status={holder.status} />
								</td>
								<td class="px-2 py-3">
									{formatPrice(holder.price_paid, pass.currency, m['seriesPass.free']())}
								</td>
								<td class="px-2 py-3">{formatDate(holder.created_at)}</td>
								<td class="px-2 py-3">
									<div class="flex justify-end gap-2">
										{#if isOffline && holder.status === 'pending'}
											<Button
												size="sm"
												variant="outline"
												onclick={() => (holderToConfirm = holder)}
												disabled={confirmPaymentMutation.isPending}
											>
												{m['seriesPassAdmin.confirmPaymentButton']()}
											</Button>
										{/if}
										{#if holder.status !== 'cancelled'}
											<Button
												size="sm"
												variant="destructive"
												onclick={() => {
													cancelReason = '';
													holderToCancel = holder;
												}}
												disabled={cancelMutation.isPending}
											>
												{m['seriesPassAdmin.cancelHolderButton']()}
											</Button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if totalPages > 1}
				<div class="flex items-center justify-between">
					<Button
						variant="outline"
						size="sm"
						onclick={() => (currentPage = Math.max(1, currentPage - 1))}
						disabled={currentPage <= 1}
					>
						{m['seriesPass.previous']()}
					</Button>
					<span class="text-sm text-muted-foreground">
						{m['seriesPass.pageIndicator']({ currentPage, totalPages })}
					</span>
					<Button
						variant="outline"
						size="sm"
						onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
						disabled={currentPage >= totalPages}
					>
						{m['seriesPass.next']()}
					</Button>
				</div>
			{/if}
		{/if}
	</DialogContent>
</Dialog>

<!-- Confirm offline payment -->
<ConfirmDialog
	isOpen={!!holderToConfirm}
	title={m['seriesPassAdmin.confirmPaymentTitle']()}
	message={m['seriesPassAdmin.confirmPaymentMessage']({
		name: holderToConfirm ? holderName(holderToConfirm) : '',
		price: formatPrice(holderToConfirm?.price_paid, pass.currency, m['seriesPass.free']())
	})}
	confirmText={m['seriesPassAdmin.confirmPaymentButton']()}
	cancelText={m['seriesPass.cancelButton']()}
	variant="warning"
	onConfirm={() => holderToConfirm?.id && confirmPaymentMutation.mutate(holderToConfirm.id)}
	onCancel={() => (holderToConfirm = null)}
/>

<!-- Cancel held pass (with optional reason) -->
{#if holderToCancel}
	<Dialog open onOpenChange={() => (holderToCancel = null)}>
		<DialogContent class="sm:max-w-[440px]">
			<DialogHeader>
				<DialogTitle>{m['seriesPassAdmin.cancelHolderTitle']()}</DialogTitle>
				<DialogDescription>
					{m['seriesPassAdmin.cancelHolderMessage']({ name: holderName(holderToCancel) })}
				</DialogDescription>
			</DialogHeader>
			<div>
				<Label for="cancel-reason">{m['seriesPassAdmin.cancelReasonLabel']()}</Label>
				<Input
					id="cancel-reason"
					bind:value={cancelReason}
					placeholder={m['seriesPassAdmin.cancelReasonPlaceholder']()}
					maxlength={500}
				/>
			</div>
			<div class="flex justify-end gap-2">
				<Button
					variant="outline"
					onclick={() => (holderToCancel = null)}
					disabled={cancelMutation.isPending}
				>
					{m['seriesPassAdmin.keepPassButton']()}
				</Button>
				<Button
					variant="destructive"
					onclick={() =>
						holderToCancel?.id &&
						cancelMutation.mutate({ heldPassId: holderToCancel.id, reason: cancelReason })}
					disabled={cancelMutation.isPending}
				>
					{#if cancelMutation.isPending}
						{m['seriesPass.processing']()}
					{:else}
						{m['seriesPassAdmin.cancelHolderConfirm']()}
					{/if}
				</Button>
			</div>
		</DialogContent>
	</Dialog>
{/if}
