<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { eventadminwaitlistListWaitlist, eventadminwaitlistDeleteWaitlistEntry } from '$lib/api';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		Users,
		Trash2,
		Calendar,
		Loader2,
		AlertCircle,
		Settings,
		Send,
		Ban,
		RotateCcw,
		X
	} from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import WaitlistSettingsModal from '$lib/components/events/waitlist/WaitlistSettingsModal.svelte';
	import WaitlistOfferStatusBadge from '$lib/components/events/waitlist/WaitlistOfferStatusBadge.svelte';
	import OfferExpiryCountdown from '$lib/components/events/waitlist/OfferExpiryCountdown.svelte';
	import {
		createWaitlistSettingsQueryOptions,
		createWaitlistOffersQueryOptions,
		createCreateWaitlistOfferMutationOptions,
		createRevokeWaitlistOfferMutationOptions,
		createReactivateWaitlistOfferMutationOptions
	} from '$lib/api/queries/waitlist-offers';
	import type {
		WaitlistEntrySchema,
		WaitlistOfferSchema,
		WaitlistOfferStatus
	} from '$lib/api/generated/types.gen';
	import { toast } from 'svelte-sonner';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Pagination state
	let currentPage = $state(1);
	const pageSize = $state(20);

	// Tabs
	let activeTab = $state<'entries' | 'offers'>('entries');

	// Offers filter & pagination
	const offerStatusFilters: WaitlistOfferStatus[] = ['pending', 'claimed', 'expired', 'revoked'];
	let offerStatus = $state<WaitlistOfferStatus>('pending');
	let offerPage = $state(1);

	// Settings modal state
	let settingsModalOpen = $state(false);

	// Capacity banner state
	let capacityBannerOpen = $state(false);

	// Per-row action target (to scope spinners)
	let activeActionEntryId = $state<string | null>(null);
	let activeActionOfferId = $state<string | null>(null);

	// Fetch waitlist with pagination
	const waitlistQuery = createQuery(() => ({
		queryKey: ['waitlist', data.eventId, currentPage],
		queryFn: async () => {
			const response = await eventadminwaitlistListWaitlist({
				path: { event_id: data.eventId },
				query: { page: currentPage, page_size: pageSize },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to load waitlist');
			}

			return response.data;
		},
		initialData: currentPage === 1 ? data.waitlistData : undefined
	}));

	// Settings query
	const settingsQuery = createQuery(
		createWaitlistSettingsQueryOptions(data.eventId, () => accessToken)
	);

	// Offers query (driven by reactive params)
	const offersQuery = createQuery(
		createWaitlistOffersQueryOptions(
			data.eventId,
			() => accessToken,
			() => ({ status: offerStatus, page: offerPage })
		)
	);

	// Mutations
	const deleteMutation = createMutation(() => ({
		mutationFn: async (waitlistId: string) => {
			const response = await eventadminwaitlistDeleteWaitlistEntry({
				path: { event_id: data.eventId, waitlist_id: waitlistId },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error('Failed to remove from waitlist');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['waitlist', data.eventId] });
		}
	}));

	const createOfferMutation = createMutation(
		createCreateWaitlistOfferMutationOptions(data.eventId, () => accessToken, queryClient)
	);

	const revokeOfferMutation = createMutation(
		createRevokeWaitlistOfferMutationOptions(data.eventId, () => accessToken, queryClient)
	);

	const reactivateOfferMutation = createMutation(
		createReactivateWaitlistOfferMutationOptions(data.eventId, () => accessToken, queryClient)
	);

	function handleDelete(waitlistId: string, userName: string) {
		if (confirm(m['orgAdmin.waitlist.confirmDelete']({ userName }))) {
			deleteMutation.mutate(waitlistId);
		}
	}

	// Extract HTTP status / detail from various error shapes we may get back from
	// the generated SDK's `response.error`.
	function getErrorStatus(err: unknown): number | null {
		if (err && typeof err === 'object') {
			const e = err as { status?: unknown; statusCode?: unknown };
			if (typeof e.status === 'number') return e.status;
			if (typeof e.statusCode === 'number') return e.statusCode;
		}
		return null;
	}

	function getErrorDetail(err: unknown): string {
		if (err && typeof err === 'object') {
			const e = err as { detail?: unknown; message?: unknown };
			if (typeof e.detail === 'string') return e.detail;
			if (typeof e.message === 'string') return e.message;
		}
		if (err instanceof Error) return err.message;
		return '';
	}

	function isCapacityError(err: unknown): boolean {
		return /capacity/i.test(getErrorDetail(err));
	}

	function handleMutationError(err: unknown, fallback: string) {
		const status = getErrorStatus(err);
		const detail = getErrorDetail(err);
		// SDK errors (response.error) often don't carry status. Use the message
		// shape as a fallback signal for the two 409 cases.
		if (status === 409 || /capacity/i.test(detail) || /pending offer/i.test(detail)) {
			if (isCapacityError(err)) {
				capacityBannerOpen = true;
				return;
			}
			toast.error(detail || fallback);
			return;
		}
		toast.error(detail || fallback);
	}

	function issueOffer(entry: WaitlistEntrySchema) {
		activeActionEntryId = entry.id;
		createOfferMutation.mutate(
			{ waitlist_entry_id: entry.id },
			{
				onSettled: () => {
					activeActionEntryId = null;
				},
				onSuccess: () => {
					toast.success(m['orgAdmin.waitlist.offer.issue']());
				},
				onError: (err) => handleMutationError(err, 'Failed to issue offer')
			}
		);
	}

	function revokeOffer(offerId: string) {
		activeActionOfferId = offerId;
		revokeOfferMutation.mutate(offerId, {
			onSettled: () => {
				activeActionOfferId = null;
			},
			onSuccess: () => {
				toast.success(m['orgAdmin.waitlist.offer.revoke']());
			},
			onError: (err) => handleMutationError(err, 'Failed to revoke offer')
		});
	}

	function reactivateOffer(offerId: string) {
		activeActionOfferId = offerId;
		reactivateOfferMutation.mutate(
			{ offerId },
			{
				onSettled: () => {
					activeActionOfferId = null;
				},
				onSuccess: () => {
					toast.success(m['orgAdmin.waitlist.offer.reactivate']());
				},
				onError: (err) => handleMutationError(err, 'Failed to reactivate offer')
			}
		);
	}

	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	// Humanize an ISO 8601 duration like "PT24H", "P1DT6H", "PT45M".
	function humanizeIsoDuration(iso: string | null | undefined): string {
		if (!iso) return '—';
		const re = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
		const match = re.exec(iso);
		if (!match) return iso;
		const [, d, h, mm, s] = match;
		const parts: string[] = [];
		if (d && d !== '0') parts.push(`${d}d`);
		if (h && h !== '0') parts.push(`${h}h`);
		if (mm && mm !== '0') parts.push(`${mm}m`);
		if (s && s !== '0') parts.push(`${s}s`);
		return parts.length > 0 ? parts.join(' ') : '—';
	}

	function shortUserId(id: string | null | undefined): string {
		if (!id) return '—';
		return id.length > 8 ? `${id.slice(0, 8)}…` : id;
	}

	// Pagination controls
	const totalPages = $derived(
		waitlistQuery.data ? Math.ceil(waitlistQuery.data.count / pageSize) : 1
	);
	const canGoPrev = $derived(currentPage > 1);
	const canGoNext = $derived(currentPage < totalPages);

	function goToPrevPage() {
		if (canGoPrev) {
			currentPage--;
		}
	}

	function goToNextPage() {
		if (canGoNext) {
			currentPage++;
		}
	}

	// Offers pagination
	const offersTotalPages = $derived(
		offersQuery.data ? Math.max(1, Math.ceil(offersQuery.data.count / 20)) : 1
	);
	const offersCanGoPrev = $derived(offerPage > 1);
	const offersCanGoNext = $derived(offerPage < offersTotalPages);

	function offersGoPrev() {
		if (offersCanGoPrev) offerPage--;
	}
	function offersGoNext() {
		if (offersCanGoNext) offerPage++;
	}

	function selectOfferStatus(status: WaitlistOfferStatus) {
		offerStatus = status;
		offerPage = 1;
	}

	function jumpToPendingOffers() {
		activeTab = 'offers';
		selectOfferStatus('pending');
		capacityBannerOpen = false;
		// Scroll to anchor if rendered.
		if (typeof document !== 'undefined') {
			const el = document.getElementById('waitlist-offers-section');
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}
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

	function entryActionFor(offer: WaitlistOfferSchema | null | undefined) {
		if (!offer) return 'issue' as const;
		if (offer.status === 'pending') return 'revoke' as const;
		if (offer.status === 'expired' || offer.status === 'revoked') return 'reactivate' as const;
		return 'none' as const;
	}

	const settings = $derived(settingsQuery.data ?? null);
	const advancedDisabled = $derived(settings ? settings.waitlist_time_window === null : true);
</script>

<svelte:head>
	<title>{m['orgAdmin.waitlist.pageTitle']()} - {organization.name} Admin | Revel</title>
	<meta
		name="description"
		content={m['orgAdmin.waitlist.metaDescription']({ orgName: organization.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['orgAdmin.waitlist.pageTitle']()}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">{m['orgAdmin.waitlist.pageDescription']()}</p>
		</div>
	</div>

	<!-- Capacity banner -->
	{#if capacityBannerOpen}
		<div
			class="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
			role="alert"
		>
			<div class="flex items-start gap-2">
				<AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
				<span>{m['orgAdmin.waitlist.offer.capacityBanner']()}</span>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={jumpToPendingOffers}
					class="border-amber-400 bg-white text-amber-900 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/70"
				>
					{m['orgAdmin.waitlist.offer.viewPendingShortcut']()}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					aria-label="Dismiss"
					onclick={() => (capacityBannerOpen = false)}
				>
					<X class="h-4 w-4" aria-hidden="true" />
				</Button>
			</div>
		</div>
	{/if}

	<!-- Settings card -->
	<section class="rounded-lg border bg-card p-4 sm:p-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div class="flex items-start gap-3">
				<Settings class="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
				<div>
					<h2 class="text-lg font-semibold">{m['orgAdmin.waitlist.settings.title']()}</h2>
					{#if settingsQuery.isLoading}
						<p class="mt-1 text-sm text-muted-foreground">
							<Loader2 class="inline h-3.5 w-3.5 animate-spin" aria-hidden="true" />
						</p>
					{:else if settings && advancedDisabled}
						<p class="mt-1 text-sm text-muted-foreground">
							{m['orgAdmin.waitlist.settings.disabled']()}
						</p>
					{/if}
				</div>
			</div>
			<Button
				variant="outline"
				size="sm"
				onclick={() => (settingsModalOpen = true)}
				disabled={!settings}
				class="self-start sm:self-auto"
			>
				{m['orgAdmin.waitlist.settings.editButton']()}
			</Button>
		</div>

		{#if settings && !advancedDisabled}
			<dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">
						{m['waitlistSettings.timeWindow.label']()}
					</dt>
					<dd class="mt-0.5 text-sm font-medium">
						{humanizeIsoDuration(settings.waitlist_time_window)}
					</dd>
				</div>
				<div>
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">
						{m['waitlistSettings.batchSize.label']()}
					</dt>
					<dd class="mt-0.5 text-sm font-medium">
						{settings.waitlist_batch_size === 0 ? '∞' : settings.waitlist_batch_size}
					</dd>
				</div>
				<div>
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">
						{m['waitlistSettings.cutoffDate.label']()}
					</dt>
					<dd class="mt-0.5 text-sm font-medium">
						{settings.waitlist_cutoff_date ? formatDate(settings.waitlist_cutoff_date) : '—'}
					</dd>
				</div>
				<div>
					<dt class="text-xs uppercase tracking-wide text-muted-foreground">
						{m['waitlistSettings.lotteryMode.label']()}
					</dt>
					<dd class="mt-0.5 text-sm font-medium">
						{settings.waitlist_lottery_mode ? 'Yes' : 'No'}
					</dd>
				</div>
			</dl>
		{/if}
	</section>

	<!-- Tabs: Entries / Offers -->
	<Tabs bind:value={activeTab} class="w-full">
		<TabsList class="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
			<TabsTrigger value="entries">{m['orgAdmin.waitlist.offer.tabsEntries']()}</TabsTrigger>
			<TabsTrigger value="offers">{m['orgAdmin.waitlist.offer.tabsOffers']()}</TabsTrigger>
		</TabsList>

		<!-- Entries tab -->
		<TabsContent value="entries" class="mt-4 space-y-4">
			{#if waitlistQuery.isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
					<span class="sr-only">{m['orgAdmin.waitlist.loading']()}</span>
				</div>
			{:else if waitlistQuery.isError}
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
			{:else if waitlistQuery.data && waitlistQuery.data.results.length === 0}
				<div class="rounded-lg border border-border bg-card p-12 text-center">
					<Users class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
					<h3 class="mt-4 text-lg font-semibold">{m['orgAdmin.waitlist.empty.title']()}</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{m['orgAdmin.waitlist.empty.description']()}
					</p>
				</div>
			{:else if waitlistQuery.data}
				<!-- Stats -->
				<div class="rounded-lg border bg-card p-4">
					<div class="flex items-center gap-2">
						<Users class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
						<p class="text-sm font-medium">
							{m['orgAdmin.waitlist.totalCount']({
								count: waitlistQuery.data.count,
								plural:
									waitlistQuery.data.count === 1 ? '' : m['orgAdmin.waitlist.totalCount_plural']()
							})}
						</p>
					</div>
				</div>

				<!-- Desktop Table -->
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
							{#each waitlistQuery.data.results as entry (entry.id)}
								{@const offer = entry.current_offer ?? null}
								{@const action = entryActionFor(offer)}
								{@const offerBusy =
									activeActionOfferId === offer?.id &&
									(revokeOfferMutation.isPending || reactivateOfferMutation.isPending)}
								{@const entryBusy =
									activeActionEntryId === entry.id && createOfferMutation.isPending}
								<tr class="transition-colors hover:bg-muted/50">
									<td class="px-4 py-3 text-sm">
										<div class="font-medium">
											{entry.user.first_name}
											{entry.user.last_name}
										</div>
									</td>
									<td class="px-4 py-3 text-sm text-muted-foreground">
										{entry.user.email}
									</td>
									<td class="px-4 py-3 text-sm text-muted-foreground">
										<div class="flex items-center gap-2">
											<Calendar class="h-4 w-4" aria-hidden="true" />
											{formatDate(entry.created_at)}
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
													onclick={() => issueOffer(entry)}
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
													onclick={() => revokeOffer(offer.id ?? '')}
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
													onclick={() => reactivateOffer(offer.id ?? '')}
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
												onclick={() =>
													handleDelete(
														entry.id,
														`${entry.user.first_name} ${entry.user.last_name}`
													)}
												disabled={deleteMutation.isPending}
												class="text-destructive hover:bg-destructive/10 hover:text-destructive"
											>
												{#if deleteMutation.isPending}
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

				<!-- Mobile Cards -->
				<div class="grid gap-4 md:hidden">
					{#each waitlistQuery.data.results as entry (entry.id)}
						{@const offer = entry.current_offer ?? null}
						{@const action = entryActionFor(offer)}
						{@const offerBusy =
							activeActionOfferId === offer?.id &&
							(revokeOfferMutation.isPending || reactivateOfferMutation.isPending)}
						{@const entryBusy = activeActionEntryId === entry.id && createOfferMutation.isPending}
						<div class="rounded-lg border bg-card p-4">
							<div class="space-y-3">
								<div>
									<div class="font-medium">
										{entry.user.first_name}
										{entry.user.last_name}
									</div>
									<div class="text-sm text-muted-foreground">{entry.user.email}</div>
								</div>

								<div class="flex items-center gap-2 text-sm text-muted-foreground">
									<Calendar class="h-4 w-4" aria-hidden="true" />
									{formatDate(entry.created_at)}
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
											onclick={() => issueOffer(entry)}
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
											onclick={() => revokeOffer(offer.id ?? '')}
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
											onclick={() => reactivateOffer(offer.id ?? '')}
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
										onclick={() =>
											handleDelete(entry.id, `${entry.user.first_name} ${entry.user.last_name}`)}
										disabled={deleteMutation.isPending}
										class="w-full"
									>
										{#if deleteMutation.isPending}
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

				<!-- Pagination -->
				{#if totalPages > 1}
					<div class="flex items-center justify-between border-t pt-4">
						<p class="text-sm text-muted-foreground">
							{m['orgAdmin.waitlist.pagination.info']({
								current: currentPage,
								total: totalPages
							})}
						</p>
						<div class="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onclick={goToPrevPage}
								disabled={!canGoPrev || waitlistQuery.isFetching}
							>
								{m['orgAdmin.waitlist.pagination.previous']()}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onclick={goToNextPage}
								disabled={!canGoNext || waitlistQuery.isFetching}
							>
								{m['orgAdmin.waitlist.pagination.next']()}
							</Button>
						</div>
					</div>
				{/if}
			{/if}
		</TabsContent>

		<!-- Offers tab -->
		<TabsContent value="offers" class="mt-4 space-y-4">
			<section id="waitlist-offers-section" class="space-y-4">
				<!-- Status filter chips -->
				<div
					class="flex flex-wrap gap-2"
					role="tablist"
					aria-label={m['orgAdmin.waitlist.offer.statusColumn']()}
				>
					{#each offerStatusFilters as status (status)}
						{@const selected = offerStatus === status}
						<button
							type="button"
							role="tab"
							aria-selected={selected}
							onclick={() => selectOfferStatus(status)}
							class="rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {selected
								? 'border-primary bg-primary text-primary-foreground'
								: 'border-border bg-card text-foreground hover:bg-muted'}"
						>
							{m[`orgAdmin.waitlist.offer.filter.${status}`]()}
						</button>
					{/each}
				</div>

				{#if offersQuery.isLoading}
					<div class="flex items-center justify-center py-12">
						<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
					</div>
				{:else if offersQuery.isError}
					<div
						class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center"
						role="alert"
					>
						<AlertCircle class="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
						<h3 class="mt-4 text-lg font-semibold text-destructive">
							{m['orgAdmin.waitlist.error.title']()}
						</h3>
					</div>
				{:else if offersQuery.data && offersQuery.data.results.length === 0}
					<div class="rounded-lg border border-border bg-card p-12 text-center">
						<Users class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
						<p class="mt-2 text-sm text-muted-foreground">
							{m['orgAdmin.waitlist.empty.description']()}
						</p>
					</div>
				{:else if offersQuery.data}
					<!-- Desktop Offers Table -->
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
										{m['waitlistSettings.timeWindow.label']()}
									</th>
									<th class="px-4 py-3 text-right text-sm font-medium">
										{m['orgAdmin.waitlist.table.actions']()}
									</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{#each offersQuery.data.results as offer (offer.id ?? offer.batch_id + offer.user)}
									{@const busy =
										activeActionOfferId === offer.id &&
										(revokeOfferMutation.isPending || reactivateOfferMutation.isPending)}
									{@const label = offerActionLabel(offer.status)}
									<tr class="transition-colors hover:bg-muted/50">
										<td class="px-4 py-3 font-mono text-xs text-muted-foreground">
											{shortUserId(offer.user)}
										</td>
										<td class="px-4 py-3 text-sm">
											<WaitlistOfferStatusBadge status={offer.status} />
										</td>
										<td class="px-4 py-3 text-sm text-muted-foreground">
											{#if offer.status === 'pending'}
												<OfferExpiryCountdown compact expiresAt={offer.expires_at} />
											{:else}
												{formatDate(offer.expires_at)}
											{/if}
										</td>
										<td class="px-4 py-3 text-right">
											{#if label}
												<Button
													variant="outline"
													size="sm"
													onclick={() =>
														offer.status === 'pending'
															? revokeOffer(offer.id ?? '')
															: reactivateOffer(offer.id ?? '')}
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

					<!-- Mobile Offer Cards -->
					<div class="grid gap-4 md:hidden">
						{#each offersQuery.data.results as offer (offer.id ?? offer.batch_id + offer.user)}
							{@const busy =
								activeActionOfferId === offer.id &&
								(revokeOfferMutation.isPending || reactivateOfferMutation.isPending)}
							{@const label = offerActionLabel(offer.status)}
							<div class="space-y-3 rounded-lg border bg-card p-4">
								<div class="flex items-start justify-between gap-2">
									<div class="font-mono text-xs text-muted-foreground">
										{shortUserId(offer.user)}
									</div>
									<WaitlistOfferStatusBadge status={offer.status} />
								</div>
								<div class="text-sm text-muted-foreground">
									{#if offer.status === 'pending'}
										<OfferExpiryCountdown compact expiresAt={offer.expires_at} />
									{:else}
										{formatDate(offer.expires_at)}
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
													? revokeOffer(offer.id ?? '')
													: reactivateOffer(offer.id ?? '')}
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

					<!-- Offers pagination -->
					{#if offersTotalPages > 1}
						<div class="flex items-center justify-between border-t pt-4">
							<p class="text-sm text-muted-foreground">
								{m['orgAdmin.waitlist.pagination.info']({
									current: offerPage,
									total: offersTotalPages
								})}
							</p>
							<div class="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onclick={offersGoPrev}
									disabled={!offersCanGoPrev || offersQuery.isFetching}
								>
									{m['orgAdmin.waitlist.pagination.previous']()}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onclick={offersGoNext}
									disabled={!offersCanGoNext || offersQuery.isFetching}
								>
									{m['orgAdmin.waitlist.pagination.next']()}
								</Button>
							</div>
						</div>
					{/if}
				{/if}
			</section>
		</TabsContent>
	</Tabs>
</div>

<!-- Settings modal -->
{#if settings}
	<WaitlistSettingsModal
		open={settingsModalOpen}
		onOpenChange={(v) => (settingsModalOpen = v)}
		mode="edit"
		eventId={data.eventId}
		initialValues={settings}
	/>
{/if}

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
