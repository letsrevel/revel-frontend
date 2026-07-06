<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertCircle, Ban, Loader2, RotateCcw, Users } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import WaitlistOfferStatusBadge from '$lib/components/events/waitlist/WaitlistOfferStatusBadge.svelte';
	import OfferExpiryCountdown from '$lib/components/events/waitlist/OfferExpiryCountdown.svelte';
	import type {
		PaginatedResponseSchemaWaitlistOfferSchema,
		WaitlistOfferStatus
	} from '$lib/api/generated/types.gen';

	interface Props {
		data: PaginatedResponseSchemaWaitlistOfferSchema | undefined;
		isLoading: boolean;
		isError: boolean;
		isFetching: boolean;
		offerStatus: WaitlistOfferStatus;
		offerStatusFilters: readonly WaitlistOfferStatus[];
		onSelectStatus: (status: WaitlistOfferStatus) => void;
		currentPage: number;
		totalPages: number;
		canGoPrev: boolean;
		canGoNext: boolean;
		onPrev: () => void;
		onNext: () => void;
		onRevokeOffer: (offerId: string) => void;
		onReactivateOffer: (args: { offerId: string; userName: string }) => void;
		activeActionOfferId: string | null;
		isRevokePending: boolean;
		isReactivatePending: boolean;
		formatDateTime: (iso: string) => string;
	}

	const {
		data,
		isLoading,
		isError,
		isFetching,
		offerStatus,
		offerStatusFilters,
		onSelectStatus,
		currentPage,
		totalPages,
		canGoPrev,
		canGoNext,
		onPrev,
		onNext,
		onRevokeOffer,
		onReactivateOffer,
		activeActionOfferId,
		isRevokePending,
		isReactivatePending,
		formatDateTime
	}: Props = $props();

	function fullName(u: { first_name?: string | null; last_name?: string | null }): string {
		return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
	}

	function offerActionLabel(status: WaitlistOfferStatus): string {
		switch (status) {
			case 'pending':
				return m['orgAdmin.waitlist.offer.revoke']();
			case 'expired':
			case 'revoked':
				return m['orgAdmin.waitlist.offer.reactivate']();
			default:
				return '';
		}
	}
</script>

<section id="waitlist-offers-section" class="space-y-4">
	<div class="flex flex-wrap gap-2" aria-label={m['orgAdmin.waitlist.offer.statusColumn']()}>
		{#each offerStatusFilters as status (status)}
			{@const selected = offerStatus === status}
			<button
				type="button"
				aria-pressed={selected}
				onclick={() => onSelectStatus(status)}
				class="rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {selected
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-border bg-card text-foreground hover:bg-muted'}"
			>
				{m[`orgAdmin.waitlist.offer.filter.${status}`]()}
			</button>
		{/each}
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
		</div>
	{:else if isError}
		<div
			class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center"
			role="alert"
		>
			<AlertCircle class="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
			<h3 class="mt-4 text-lg font-semibold text-destructive">
				{m['orgAdmin.waitlist.error.title']()}
			</h3>
		</div>
	{:else if data && data.results.length === 0}
		<div class="rounded-lg border border-border bg-card p-12 text-center">
			<Users class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<p class="mt-2 text-sm text-muted-foreground">
				{m['orgAdmin.waitlist.empty.description']()}
			</p>
		</div>
	{:else if data}
		<div class="hidden overflow-hidden rounded-lg border md:block">
			<table class="w-full border-collapse">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-4 py-3 text-left text-sm font-medium">
							{m['orgAdmin.waitlist.table.user']()}
						</th>
						<th class="px-4 py-3 text-left text-sm font-medium">
							{m['orgAdmin.waitlist.offer.statusColumn']()}
						</th>
						<th class="px-4 py-3 text-left text-sm font-medium">
							{m['orgAdmin.waitlist.offer.expiresColumn']()}
						</th>
						<th class="px-4 py-3 text-right text-sm font-medium">
							{m['orgAdmin.waitlist.table.actions']()}
						</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each data.results as offer (offer.id ?? `${offer.batch_id}-${offer.user.id}`)}
						{@const busy =
							activeActionOfferId === offer.id && (isRevokePending || isReactivatePending)}
						{@const label = offerActionLabel(offer.status)}
						<tr class="transition-colors hover:bg-muted/50">
							<td class="px-4 py-3 text-sm">
								<div class="font-medium">
									{offer.user.display_name || fullName(offer.user) || offer.user.email}
								</div>
								{#if offer.user.email && (offer.user.display_name || fullName(offer.user))}
									<div class="text-xs text-muted-foreground">{offer.user.email}</div>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm">
								<WaitlistOfferStatusBadge status={offer.status} />
							</td>
							<td class="px-4 py-3 text-sm text-muted-foreground">
								{#if offer.status === 'pending'}
									<OfferExpiryCountdown compact expiresAt={offer.expires_at} />
								{:else}
									{formatDateTime(offer.expires_at)}
								{/if}
							</td>
							<td class="px-4 py-3 text-right">
								{#if label}
									<Button
										variant="outline"
										size="sm"
										onclick={() =>
											offer.status === 'pending'
												? onRevokeOffer(offer.id ?? '')
												: onReactivateOffer({
														offerId: offer.id ?? '',
														userName:
															offer.user.display_name ||
															fullName(offer.user) ||
															offer.user.email ||
															''
													})}
										disabled={busy || !offer.id}
									>
										{#if busy}
											<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
										{:else if offer.status === 'pending'}
											<Ban class="h-4 w-4" aria-hidden="true" />
										{:else}
											<RotateCcw class="h-4 w-4" aria-hidden="true" />
										{/if}
										<span class="ml-1">{label}</span>
									</Button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="grid gap-4 md:hidden">
			{#each data.results as offer (offer.id ?? `${offer.batch_id}-${offer.user.id}`)}
				{@const busy = activeActionOfferId === offer.id && (isRevokePending || isReactivatePending)}
				{@const label = offerActionLabel(offer.status)}
				<div class="space-y-3 rounded-lg border bg-card p-4">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-medium">
								{offer.user.display_name || fullName(offer.user) || offer.user.email}
							</div>
							{#if offer.user.email && (offer.user.display_name || fullName(offer.user))}
								<div class="truncate text-xs text-muted-foreground">{offer.user.email}</div>
							{/if}
						</div>
						<WaitlistOfferStatusBadge status={offer.status} />
					</div>
					<div class="text-sm text-muted-foreground">
						{#if offer.status === 'pending'}
							<OfferExpiryCountdown compact expiresAt={offer.expires_at} />
						{:else}
							{formatDateTime(offer.expires_at)}
						{/if}
					</div>
					{#if label}
						<div class="border-t pt-3">
							<Button
								variant="outline"
								size="sm"
								class="w-full"
								onclick={() =>
									offer.status === 'pending'
										? onRevokeOffer(offer.id ?? '')
										: onReactivateOffer({
												offerId: offer.id ?? '',
												userName:
													offer.user.display_name || fullName(offer.user) || offer.user.email || ''
											})}
								disabled={busy || !offer.id}
							>
								{#if busy}
									<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
								{:else if offer.status === 'pending'}
									<Ban class="h-4 w-4" aria-hidden="true" />
								{:else}
									<RotateCcw class="h-4 w-4" aria-hidden="true" />
								{/if}
								<span class="ml-1">{label}</span>
							</Button>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="flex items-center justify-between border-t pt-4">
				<p class="text-sm text-muted-foreground">
					{m['orgAdmin.waitlist.pagination.info']({
						current: currentPage,
						total: totalPages
					})}
				</p>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={onPrev} disabled={!canGoPrev || isFetching}>
						{m['orgAdmin.waitlist.pagination.previous']()}
					</Button>
					<Button variant="outline" size="sm" onclick={onNext} disabled={!canGoNext || isFetching}>
						{m['orgAdmin.waitlist.pagination.next']()}
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</section>
