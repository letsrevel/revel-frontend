<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
	import { BookUser, Download, Plus, ChevronLeft, ChevronRight, Loader2 } from '@lucide/svelte';
	import type { PageData } from './$types';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import { toast } from 'svelte-sonner';
	import { authStore } from '$lib/stores/auth.svelte';
	import { allTiersQueryOptions } from '$lib/queries/membership-tiers';
	import { standardTiers } from '$lib/utils/membership-tier-kind';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import RegisterFilters from '$lib/components/member-register/RegisterFilters.svelte';
	import RegisterTable from '$lib/components/member-register/RegisterTable.svelte';
	import RegisterCards from '$lib/components/member-register/RegisterCards.svelte';
	import RecordFormDialog from '$lib/components/member-register/RecordFormDialog.svelte';
	import EndRecordDialog from '$lib/components/member-register/EndRecordDialog.svelte';
	import DeleteRecordDialog from '$lib/components/member-register/DeleteRecordDialog.svelte';
	import RegisterExportDialog from '$lib/components/member-register/RegisterExportDialog.svelte';
	import RegisterErrorAlert from '$lib/components/member-register/RegisterErrorAlert.svelte';
	import { listRegister, memberRegisterKeys } from '$lib/member-register/api';
	import { describeRegisterError } from '$lib/member-register/errors';
	import {
		DEFAULT_FILTERS,
		REGISTER_PAGE_SIZE,
		pageToRedirect,
		filtersToSearch,
		hasActiveFilters,
		parseFilters,
		type RegisterFilters as Filters
	} from '$lib/member-register/filters';
	import { resolveOrgTimezone } from '$lib/member-register/org-timezone';

	const { data }: { data: PageData } = $props();

	const organization = $derived(data.organization);
	const slug = $derived(organization.slug);
	const accessToken = $derived(authStore.accessToken);
	const timezone = $derived(resolveOrgTimezone(organization));

	// The URL query is the single source of truth for the filters: shareable,
	// and back/forward restores them.
	const filters = $derived(parseFilters($page.url.searchParams));

	function applyFilters(next: Filters, opts?: { replace?: boolean }) {
		const qs = filtersToSearch(next);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?" string keeps the current pathname (resolve() cannot express search params)
		goto(qs ? `?${qs}` : '?', {
			replaceState: opts?.replace ?? false,
			keepFocus: true,
			noScroll: true
		});
	}

	// All-kinds tier list: the filter offers standard AND temporary tiers; the
	// create/edit form offers the standard ones only (derived below).
	const tiersQuery = createQuery(() => ({
		...allTiersQueryOptions(slug, accessToken),
		enabled: !!accessToken
	}));
	const allTiers = $derived(tiersQuery.data ?? []);
	const formTiers = $derived(standardTiers(allTiers));

	const listQuery = createQuery(() => ({
		queryKey: memberRegisterKeys.list(slug, filters),
		queryFn: () => listRegister(slug, accessToken, filters),
		enabled: !!accessToken,
		placeholderData: keepPreviousData
	}));

	const records = $derived(listQuery.data?.results ?? []);
	const total = $derived(listQuery.data?.count ?? 0);
	const pageCount = $derived(Math.max(1, Math.ceil(total / REGISTER_PAGE_SIZE)));
	const rangeFrom = $derived(total === 0 ? 0 : (filters.page - 1) * REGISTER_PAGE_SIZE + 1);
	const rangeTo = $derived(Math.min(filters.page * REGISTER_PAGE_SIZE, total));
	const listError = $derived(
		listQuery.error ? describeRegisterError(listQuery.error, 'save') : null
	);

	// A page past the last one (stale `?page=`, or the last row of the last page was
	// deleted) holds no rows although the register is not empty: go to the last page.
	const redirectPage = $derived(
		listQuery.isSuccess && !listQuery.isPlaceholderData
			? pageToRedirect(records.length, total, filters.page)
			: null
	);
	$effect(() => {
		if (redirectPage !== null) applyFilters({ ...filters, page: redirectPage }, { replace: true });
	});

	// A well-formed tier id that no longer exists matches nothing (the backend
	// returns an empty list, not an error): drop the filter and say so.
	$effect(() => {
		const tierId = filters.tierId;
		if (tierId && tiersQuery.isSuccess && !allTiers.some((t) => t.id === tierId)) {
			toast.info(m['memberRegister.tierFilterStale']());
			applyFilters({ ...filters, tierId: null, page: 1 }, { replace: true });
		}
	});

	// Dialog state. Edit tracks the live row so a refetch (e.g. after a stale 409)
	// updates which fields are locked.
	let formOpen = $state(false);
	let editing = $state<MembershipRecordSchema | null>(null);
	let ending = $state<MembershipRecordSchema | null>(null);
	let deleting = $state<MembershipRecordSchema | null>(null);
	let exportOpen = $state(false);

	// Every dialog works on the LIVE row (falling back to the opened snapshot), so a
	// refetch after a 409/404 updates the lock rules and the future-date checks.
	const liveEditing = $derived(records.find((r) => r.id === editing?.id) ?? editing);
	const liveEnding = $derived(records.find((r) => r.id === ending?.id) ?? ending);
	const liveDeleting = $derived(records.find((r) => r.id === deleting?.id) ?? deleting);
	const editingPresent = $derived(!editing || records.some((r) => r.id === editing?.id));
	const endingPresent = $derived(!ending || records.some((r) => r.id === ending?.id));
	const deletingPresent = $derived(!deleting || records.some((r) => r.id === deleting?.id));

	function openCreate() {
		editing = null;
		formOpen = true;
	}
	function openEdit(record: MembershipRecordSchema) {
		editing = record;
		formOpen = true;
	}
</script>

<svelte:head>
	<title>{m['memberRegister.headTitle']({ orgName: organization.name })} | Revel</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	{#snippet headerActions()}
		<Button variant="outline" onclick={() => (exportOpen = true)}>
			<Download aria-hidden="true" />
			{m['memberRegister.exportOpen']()}
		</Button>
		<Button onclick={openCreate}>
			<Plus aria-hidden="true" />
			{m['memberRegister.addEntry']()}
		</Button>
	{/snippet}
	<PageHeader
		volume="studio"
		title={m['memberRegister.pageTitle']()}
		subtitle={m['memberRegister.pageSubtitle']()}
		actions={headerActions}
	/>

	<RegisterFilters {filters} tiers={allTiers} {timezone} onChange={applyFilters} />

	<section aria-labelledby="register-results-heading" aria-busy={listQuery.isFetching}>
		<h2 id="register-results-heading" class="sr-only">{m['memberRegister.resultsHeading']()}</h2>

		{#if listQuery.isPending}
			<p class="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
				<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{m['memberRegister.loading']()}
			</p>
		{:else if listError}
			<div class="space-y-3">
				<RegisterErrorAlert error={listError} />
				<Button variant="outline" onclick={() => listQuery.refetch()}>
					{m['memberRegister.retry']()}
				</Button>
			</div>
		{:else if records.length === 0 && redirectPage !== null}
			<p class="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
				<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{m['memberRegister.loading']()}
			</p>
		{:else if records.length === 0}
			<EmptyState
				icon={BookUser}
				title={hasActiveFilters(filters)
					? m['memberRegister.emptyFilteredTitle']()
					: m['memberRegister.emptyTitle']()}
				body={hasActiveFilters(filters)
					? m['memberRegister.emptyFilteredBody']()
					: m['memberRegister.emptyBody']()}
			>
				{#snippet action()}
					{#if hasActiveFilters(filters)}
						<Button variant="outline" onclick={() => applyFilters({ ...DEFAULT_FILTERS })}>
							{m['memberRegister.clearFilters']()}
						</Button>
					{:else}
						<Button onclick={openCreate}>
							<Plus aria-hidden="true" />
							{m['memberRegister.addEntry']()}
						</Button>
					{/if}
				{/snippet}
			</EmptyState>
		{:else}
			<RegisterTable
				{records}
				isOwner={data.isOwner}
				onEdit={openEdit}
				onEnd={(r) => (ending = r)}
				onDelete={(r) => (deleting = r)}
			/>
			<RegisterCards
				{records}
				isOwner={data.isOwner}
				onEdit={openEdit}
				onEnd={(r) => (ending = r)}
				onDelete={(r) => (deleting = r)}
			/>

			<nav
				class="mt-4 flex flex-wrap items-center justify-between gap-3"
				aria-label={m['memberRegister.paginationLabel']()}
			>
				<p class="text-sm text-muted-foreground" aria-live="polite">
					{m['memberRegister.range']({ from: rangeFrom, to: rangeTo, total })}
				</p>
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={filters.page <= 1}
						onclick={() => applyFilters({ ...filters, page: filters.page - 1 })}
					>
						<ChevronLeft aria-hidden="true" />
						{m['memberRegister.previous']()}
					</Button>
					<span class="text-sm">
						{m['memberRegister.pageOf']({ page: filters.page, pages: pageCount })}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={filters.page >= pageCount}
						onclick={() => applyFilters({ ...filters, page: filters.page + 1 })}
					>
						{m['memberRegister.next']()}
						<ChevronRight aria-hidden="true" />
					</Button>
				</div>
			</nav>
		{/if}
	</section>
</div>

<RecordFormDialog
	open={formOpen}
	record={liveEditing}
	recordPresent={editingPresent}
	{slug}
	{accessToken}
	tiers={formTiers}
	onClose={() => (formOpen = false)}
/>
<EndRecordDialog
	open={ending !== null}
	record={liveEnding}
	recordPresent={endingPresent}
	{slug}
	{accessToken}
	onClose={() => (ending = null)}
/>
<DeleteRecordDialog
	open={deleting !== null}
	record={liveDeleting}
	recordPresent={deletingPresent}
	{slug}
	{accessToken}
	onClose={() => (deleting = null)}
/>
<RegisterExportDialog
	open={exportOpen}
	{slug}
	{accessToken}
	{timezone}
	initialDay={filters.activeOn}
	onClose={() => (exportOpen = false)}
/>
