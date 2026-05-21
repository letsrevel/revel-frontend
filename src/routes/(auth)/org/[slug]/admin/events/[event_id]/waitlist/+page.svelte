<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { eventadminwaitlistListWaitlist, eventadminwaitlistDeleteWaitlistEntry } from '$lib/api';
	import { authStore } from '$lib/stores/auth.svelte';
	import { AlertCircle, X } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import WaitlistSettingsCard from '$lib/components/events/waitlist/admin/WaitlistSettingsCard.svelte';
	import WaitlistEntriesTable from '$lib/components/events/waitlist/admin/WaitlistEntriesTable.svelte';
	import WaitlistOffersTable from '$lib/components/events/waitlist/admin/WaitlistOffersTable.svelte';
	import OfferExpiryDialog from '$lib/components/events/waitlist/admin/OfferExpiryDialog.svelte';
	import {
		createWaitlistSettingsQueryOptions,
		createWaitlistOffersQueryOptions,
		createCreateWaitlistOfferMutationOptions,
		createRevokeWaitlistOfferMutationOptions,
		createReactivateWaitlistOfferMutationOptions
	} from '$lib/api/queries/waitlist-offers';
	import type { WaitlistEntrySchema, WaitlistOfferStatus } from '$lib/api/generated/types.gen';
	import { toast } from 'svelte-sonner';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	let currentPage = $state(1);
	const pageSize = $state(20);

	let activeTab = $state<'entries' | 'offers'>('entries');

	// Backend default page_size for waitlist offers is 20 (see openapi.json:
	// eventadminwaitlistoffers_list_waitlist_offers). Keep this in sync if the
	// backend default changes or pass page_size explicitly.
	const OFFERS_PAGE_SIZE = 20;
	const offerStatusFilters: readonly WaitlistOfferStatus[] = [
		'pending',
		'claimed',
		'expired',
		'revoked'
	];
	let offerStatus = $state<WaitlistOfferStatus>('pending');
	let offerPage = $state(1);

	let capacityBannerOpen = $state(false);

	let activeActionEntryId = $state<string | null>(null);
	let activeActionOfferId = $state<string | null>(null);

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

	const settingsQuery = createQuery(
		createWaitlistSettingsQueryOptions(data.eventId, () => accessToken)
	);

	const offersQuery = createQuery(
		createWaitlistOffersQueryOptions(
			data.eventId,
			() => accessToken,
			() => ({ status: offerStatus, page: offerPage })
		)
	);

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

	// Issue and reactivate both go through OfferExpiryDialog so the admin
	// picks the expiry up-front. The payload always includes expires_at —
	// the backend 400s when neither the event's `waitlist_time_window`
	// setting nor a body value is provided.
	type ExpiryDialogState =
		| { mode: 'issue'; entry: WaitlistEntrySchema }
		| { mode: 'reactivate'; offerId: string; userName: string };

	let expiryDialogState = $state<ExpiryDialogState | null>(null);
	let expiryDialogOpen = $state(false);

	function isoDurationToMinutes(iso: string | null | undefined): number | null {
		if (!iso) return null;
		const re = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
		const match = re.exec(iso);
		if (!match) return null;
		const [, d, h, mm, s] = match;
		const total =
			(d ? parseInt(d, 10) : 0) * 1440 +
			(h ? parseInt(h, 10) : 0) * 60 +
			(mm ? parseInt(mm, 10) : 0) +
			Math.round((s ? parseInt(s, 10) : 0) / 60);
		return total > 0 ? total : null;
	}

	const expiryDialogDefaultMinutes = $derived(
		isoDurationToMinutes(settingsQuery.data?.waitlist_time_window) ?? 24 * 60
	);

	function entryUserName(entry: WaitlistEntrySchema): string {
		const u = entry.user;
		return u.display_name || `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email || '';
	}

	const expiryDialogUserName = $derived(
		expiryDialogState
			? expiryDialogState.mode === 'issue'
				? entryUserName(expiryDialogState.entry)
				: expiryDialogState.userName
			: ''
	);
	const expiryDialogMode = $derived(expiryDialogState?.mode ?? 'issue');
	const expiryDialogIsPending = $derived(
		expiryDialogState?.mode === 'reactivate'
			? reactivateOfferMutation.isPending
			: createOfferMutation.isPending
	);

	function issueOffer(entry: WaitlistEntrySchema) {
		expiryDialogState = { mode: 'issue', entry };
		expiryDialogOpen = true;
	}

	function reactivateOffer(args: { offerId: string; userName: string }) {
		expiryDialogState = { mode: 'reactivate', offerId: args.offerId, userName: args.userName };
		expiryDialogOpen = true;
	}

	function handleExpiryDialogConfirm(expiresAt: string) {
		const state = expiryDialogState;
		if (!state) return;
		if (state.mode === 'issue') {
			const entry = state.entry;
			activeActionEntryId = entry.id;
			createOfferMutation.mutate(
				{ waitlist_entry_id: entry.id, expires_at: expiresAt },
				{
					onSettled: () => {
						activeActionEntryId = null;
					},
					onSuccess: () => {
						toast.success(m['orgAdmin.waitlist.offer.issue']());
						expiryDialogOpen = false;
						expiryDialogState = null;
					},
					onError: (err) => handleMutationError(err, 'Failed to issue offer')
				}
			);
		} else {
			activeActionOfferId = state.offerId;
			reactivateOfferMutation.mutate(
				{ offerId: state.offerId, body: { expires_at: expiresAt } },
				{
					onSettled: () => {
						activeActionOfferId = null;
					},
					onSuccess: () => {
						toast.success(m['orgAdmin.waitlist.offer.reactivate']());
						expiryDialogOpen = false;
						expiryDialogState = null;
					},
					onError: (err) => handleMutationError(err, 'Failed to reactivate offer')
				}
			);
		}
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

	function formatDateTime(iso: string): string {
		return new Date(iso).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

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

	const offersTotalPages = $derived(
		offersQuery.data ? Math.max(1, Math.ceil(offersQuery.data.count / OFFERS_PAGE_SIZE)) : 1
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
		if (typeof document !== 'undefined') {
			const el = document.getElementById('waitlist-offers-section');
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}
	}

	const settings = $derived(settingsQuery.data ?? null);
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
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['orgAdmin.waitlist.pageTitle']()}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">{m['orgAdmin.waitlist.pageDescription']()}</p>
		</div>
	</div>

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

	<WaitlistSettingsCard
		eventId={data.eventId}
		{settings}
		isLoading={settingsQuery.isLoading}
		{formatDateTime}
		{humanizeIsoDuration}
	/>

	<Tabs bind:value={activeTab} class="w-full">
		<TabsList class="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
			<TabsTrigger value="entries">{m['orgAdmin.waitlist.offer.tabsEntries']()}</TabsTrigger>
			<TabsTrigger value="offers">{m['orgAdmin.waitlist.offer.tabsOffers']()}</TabsTrigger>
		</TabsList>

		<TabsContent value="entries" class="mt-4 space-y-4">
			<WaitlistEntriesTable
				data={waitlistQuery.data}
				isLoading={waitlistQuery.isLoading}
				isError={waitlistQuery.isError}
				isFetching={waitlistQuery.isFetching}
				{currentPage}
				{totalPages}
				{canGoPrev}
				{canGoNext}
				onPrev={goToPrevPage}
				onNext={goToNextPage}
				onIssueOffer={issueOffer}
				onRevokeOffer={revokeOffer}
				onReactivateOffer={reactivateOffer}
				onDelete={handleDelete}
				{activeActionEntryId}
				{activeActionOfferId}
				isCreatePending={createOfferMutation.isPending}
				isRevokePending={revokeOfferMutation.isPending}
				isReactivatePending={reactivateOfferMutation.isPending}
				isDeletePending={deleteMutation.isPending}
				{formatDateTime}
			/>
		</TabsContent>

		<TabsContent value="offers" class="mt-4 space-y-4">
			<WaitlistOffersTable
				data={offersQuery.data}
				isLoading={offersQuery.isLoading}
				isError={offersQuery.isError}
				isFetching={offersQuery.isFetching}
				{offerStatus}
				{offerStatusFilters}
				onSelectStatus={selectOfferStatus}
				currentPage={offerPage}
				totalPages={offersTotalPages}
				canGoPrev={offersCanGoPrev}
				canGoNext={offersCanGoNext}
				onPrev={offersGoPrev}
				onNext={offersGoNext}
				onRevokeOffer={revokeOffer}
				onReactivateOffer={reactivateOffer}
				{activeActionOfferId}
				isRevokePending={revokeOfferMutation.isPending}
				isReactivatePending={reactivateOfferMutation.isPending}
				{formatDateTime}
			/>
		</TabsContent>
	</Tabs>
</div>

<OfferExpiryDialog
	bind:open={expiryDialogOpen}
	onOpenChange={(v) => {
		expiryDialogOpen = v;
		if (!v) expiryDialogState = null;
	}}
	mode={expiryDialogMode}
	userName={expiryDialogUserName}
	defaultMinutes={expiryDialogDefaultMinutes}
	isPending={expiryDialogIsPending}
	onConfirm={handleExpiryDialogConfirm}
/>

<style>
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
