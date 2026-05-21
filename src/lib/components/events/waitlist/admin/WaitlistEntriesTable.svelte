<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		AlertCircle,
		Ban,
		Calendar,
		Loader2,
		RotateCcw,
		Send,
		Trash2,
		Users
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import WaitlistOfferStatusBadge from '$lib/components/events/waitlist/WaitlistOfferStatusBadge.svelte';
	import OfferExpiryCountdown from '$lib/components/events/waitlist/OfferExpiryCountdown.svelte';
	import type {
		PaginatedResponseSchemaWaitlistEntrySchema,
		WaitlistEntrySchema,
		WaitlistOfferSchema
	} from '$lib/api/generated/types.gen';

	interface Props {
		data: PaginatedResponseSchemaWaitlistEntrySchema | undefined;
		isLoading: boolean;
		isError: boolean;
		isFetching: boolean;
		currentPage: number;
		totalPages: number;
		canGoPrev: boolean;
		canGoNext: boolean;
		onPrev: () => void;
		onNext: () => void;
		onIssueOffer: (entry: WaitlistEntrySchema) => void;
		onRevokeOffer: (offerId: string) => void;
		onReactivateOffer: (args: { offerId: string; userName: string }) => void;
		onDelete: (waitlistId: string, userName: string) => void;
		activeActionEntryId: string | null;
		activeActionOfferId: string | null;
		isCreatePending: boolean;
		isRevokePending: boolean;
		isReactivatePending: boolean;
		isDeletePending: boolean;
		formatDateTime: (iso: string) => string;
	}

	const {
		data,
		isLoading,
		isError,
		isFetching,
		currentPage,
		totalPages,
		canGoPrev,
		canGoNext,
		onPrev,
		onNext,
		onIssueOffer,
		onRevokeOffer,
		onReactivateOffer,
		onDelete,
		activeActionEntryId,
		activeActionOfferId,
		isCreatePending,
		isRevokePending,
		isReactivatePending,
		isDeletePending,
		formatDateTime
	}: Props = $props();

	function entryActionFor(offer: WaitlistOfferSchema | null | undefined) {
		if (!offer) return 'issue' as const;
		if (offer.status === 'pending') return 'revoke' as const;
		if (offer.status === 'expired' || offer.status === 'revoked') return 'reactivate' as const;
		return 'none' as const;
	}

	function fullName(entry: WaitlistEntrySchema): string {
		return `${entry.user.first_name} ${entry.user.last_name}`;
	}
</script>

{#if isLoading}
	<div class="flex items-center justify-center py-12">
		<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
		<span class="sr-only">{m['orgAdmin.waitlist.loading']()}</span>
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
		<p class="mt-2 text-sm text-destructive/80">
			{m['orgAdmin.waitlist.error.description']()}
		</p>
	</div>
{:else if data && data.results.length === 0}
	<div class="rounded-lg border border-border bg-card p-12 text-center">
		<Users class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
		<h3 class="mt-4 text-lg font-semibold">{m['orgAdmin.waitlist.empty.title']()}</h3>
		<p class="mt-2 text-sm text-muted-foreground">
			{m['orgAdmin.waitlist.empty.description']()}
		</p>
	</div>
{:else if data}
	<div class="rounded-lg border bg-card p-4">
		<div class="flex items-center gap-2">
			<Users class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<p class="text-sm font-medium">
				{m['orgAdmin.waitlist.totalCount']({
					count: data.count,
					plural: data.count === 1 ? '' : m['orgAdmin.waitlist.totalCount_plural']()
				})}
			</p>
		</div>
	</div>

	<div class="hidden overflow-hidden rounded-lg border md:block">
		<table class="w-full border-collapse">
			<thead class="bg-muted/50">
				<tr>
					<th class="px-4 py-3 text-left text-sm font-medium">
						{m['orgAdmin.waitlist.table.user']()}
					</th>
					<th class="px-4 py-3 text-left text-sm font-medium">
						{m['orgAdmin.waitlist.table.email']()}
					</th>
					<th class="px-4 py-3 text-left text-sm font-medium">
						{m['orgAdmin.waitlist.table.joinedAt']()}
					</th>
					<th class="px-4 py-3 text-left text-sm font-medium">
						{m['orgAdmin.waitlist.offer.statusColumn']()}
					</th>
					<th class="px-4 py-3 text-right text-sm font-medium">
						{m['orgAdmin.waitlist.table.actions']()}
					</th>
				</tr>
			</thead>
			<tbody class="divide-y">
				{#each data.results as entry (entry.id)}
					{@const offer = entry.current_offer ?? null}
					{@const action = entryActionFor(offer)}
					{@const offerBusy =
						activeActionOfferId === offer?.id && (isRevokePending || isReactivatePending)}
					{@const entryBusy = activeActionEntryId === entry.id && isCreatePending}
					<tr class="transition-colors hover:bg-muted/50">
						<td class="px-4 py-3 text-sm">
							<div class="font-medium">{fullName(entry)}</div>
						</td>
						<td class="px-4 py-3 text-sm text-muted-foreground">
							{entry.user.email}
						</td>
						<td class="px-4 py-3 text-sm text-muted-foreground">
							<div class="flex items-center gap-2">
								<Calendar class="h-4 w-4" aria-hidden="true" />
								{formatDateTime(entry.created_at)}
							</div>
						</td>
						<td class="px-4 py-3 text-sm">
							{#if offer}
								<div class="flex flex-col gap-1">
									<WaitlistOfferStatusBadge status={offer.status} />
									{#if offer.status === 'pending'}
										<OfferExpiryCountdown
											compact
											expiresAt={offer.expires_at}
											class="text-xs text-muted-foreground"
										/>
									{/if}
								</div>
							{:else}
								<span class="text-xs text-muted-foreground">—</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-right">
							<div class="flex items-center justify-end gap-2">
								{#if action === 'issue'}
									<Button
										variant="outline"
										size="sm"
										onclick={() => onIssueOffer(entry)}
										disabled={entryBusy}
									>
										{#if entryBusy}
											<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
										{:else}
											<Send class="h-4 w-4" aria-hidden="true" />
										{/if}
										<span class="ml-1">{m['orgAdmin.waitlist.offer.issue']()}</span>
									</Button>
								{:else if action === 'revoke' && offer}
									<Button
										variant="outline"
										size="sm"
										onclick={() => onRevokeOffer(offer.id ?? '')}
										disabled={offerBusy || !offer.id}
									>
										{#if offerBusy}
											<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
										{:else}
											<Ban class="h-4 w-4" aria-hidden="true" />
										{/if}
										<span class="ml-1">{m['orgAdmin.waitlist.offer.revoke']()}</span>
									</Button>
								{:else if action === 'reactivate' && offer}
									<Button
										variant="outline"
										size="sm"
										onclick={() =>
											onReactivateOffer({ offerId: offer.id ?? '', userName: fullName(entry) })}
										disabled={offerBusy || !offer.id}
									>
										{#if offerBusy}
											<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
										{:else}
											<RotateCcw class="h-4 w-4" aria-hidden="true" />
										{/if}
										<span class="ml-1">{m['orgAdmin.waitlist.offer.reactivate']()}</span>
									</Button>
								{/if}
								<Button
									variant="ghost"
									size="sm"
									onclick={() => onDelete(entry.id, fullName(entry))}
									disabled={isDeletePending}
									class="text-destructive hover:bg-destructive/10 hover:text-destructive"
								>
									{#if isDeletePending}
										<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
									{:else}
										<Trash2 class="h-4 w-4" aria-hidden="true" />
									{/if}
									<span class="ml-1">{m['orgAdmin.waitlist.actions.remove']()}</span>
								</Button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="grid gap-4 md:hidden">
		{#each data.results as entry (entry.id)}
			{@const offer = entry.current_offer ?? null}
			{@const action = entryActionFor(offer)}
			{@const offerBusy =
				activeActionOfferId === offer?.id && (isRevokePending || isReactivatePending)}
			{@const entryBusy = activeActionEntryId === entry.id && isCreatePending}
			<div class="rounded-lg border bg-card p-4">
				<div class="space-y-3">
					<div>
						<div class="font-medium">{fullName(entry)}</div>
						<div class="text-sm text-muted-foreground">{entry.user.email}</div>
					</div>

					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Calendar class="h-4 w-4" aria-hidden="true" />
						{formatDateTime(entry.created_at)}
					</div>

					{#if offer}
						<div class="flex flex-wrap items-center gap-2">
							<WaitlistOfferStatusBadge status={offer.status} />
							{#if offer.status === 'pending'}
								<OfferExpiryCountdown
									compact
									expiresAt={offer.expires_at}
									class="text-xs text-muted-foreground"
								/>
							{/if}
						</div>
					{/if}

					<div class="flex flex-col gap-2 border-t pt-3">
						{#if action === 'issue'}
							<Button
								variant="outline"
								size="sm"
								onclick={() => onIssueOffer(entry)}
								disabled={entryBusy}
								class="w-full"
							>
								{#if entryBusy}
									<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
								{:else}
									<Send class="h-4 w-4" aria-hidden="true" />
								{/if}
								<span class="ml-1">{m['orgAdmin.waitlist.offer.issue']()}</span>
							</Button>
						{:else if action === 'revoke' && offer}
							<Button
								variant="outline"
								size="sm"
								onclick={() => onRevokeOffer(offer.id ?? '')}
								disabled={offerBusy || !offer.id}
								class="w-full"
							>
								{#if offerBusy}
									<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
								{:else}
									<Ban class="h-4 w-4" aria-hidden="true" />
								{/if}
								<span class="ml-1">{m['orgAdmin.waitlist.offer.revoke']()}</span>
							</Button>
						{:else if action === 'reactivate' && offer}
							<Button
								variant="outline"
								size="sm"
								onclick={() =>
									onReactivateOffer({ offerId: offer.id ?? '', userName: fullName(entry) })}
								disabled={offerBusy || !offer.id}
								class="w-full"
							>
								{#if offerBusy}
									<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
								{:else}
									<RotateCcw class="h-4 w-4" aria-hidden="true" />
								{/if}
								<span class="ml-1">{m['orgAdmin.waitlist.offer.reactivate']()}</span>
							</Button>
						{/if}
						<Button
							variant="destructive"
							size="sm"
							onclick={() => onDelete(entry.id, fullName(entry))}
							disabled={isDeletePending}
							class="w-full"
						>
							{#if isDeletePending}
								<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							{:else}
								<Trash2 class="h-4 w-4" aria-hidden="true" />
							{/if}
							<span class="ml-1">{m['orgAdmin.waitlist.actions.remove']()}</span>
						</Button>
					</div>
				</div>
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
