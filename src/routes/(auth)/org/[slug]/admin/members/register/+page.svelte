<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
	import {
		BookUser,
		Download,
		Mail,
		Plus,
		ChevronLeft,
		ChevronRight,
		Loader2,
		GitMerge
	} from '@lucide/svelte';
	import type { PageData } from './$types';
	import type {
		MembershipRecordSchema,
		PossibleDuplicateSchema
	} from '$lib/api/generated/types.gen';
	import { toast } from 'svelte-sonner';
	import { authStore } from '$lib/stores/auth.svelte';
	import { allTiersQueryOptions } from '$lib/queries/membership-tiers';
	import { standardTiers } from '$lib/utils/membership-tier-kind';
	import { Button } from '$lib/components/ui/button';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import RegisterFilters from '$lib/components/member-register/RegisterFilters.svelte';
	import { useNow } from '$lib/member-register/now.svelte';
	import RegisterTable from '$lib/components/member-register/RegisterTable.svelte';
	import RegisterCards from '$lib/components/member-register/RegisterCards.svelte';
	import RecordFormDialog from '$lib/components/member-register/RecordFormDialog.svelte';
	import EndRecordDialog from '$lib/components/member-register/EndRecordDialog.svelte';
	import DeleteRecordDialog from '$lib/components/member-register/DeleteRecordDialog.svelte';
	import InviteRecordDialog from '$lib/components/member-register/InviteRecordDialog.svelte';
	import InviteAllDialog from '$lib/components/member-register/InviteAllDialog.svelte';
	import UnlinkRecordDialog from '$lib/components/member-register/UnlinkRecordDialog.svelte';
	import MergeRecordsDialog from '$lib/components/member-register/MergeRecordsDialog.svelte';
	import DuplicatesList from '$lib/components/member-register/DuplicatesList.svelte';
	import RegisterExportDialog from '$lib/components/member-register/RegisterExportDialog.svelte';
	import RegisterErrorAlert from '$lib/components/member-register/RegisterErrorAlert.svelte';
	import {
		listPossibleDuplicates,
		listRegister,
		memberRegisterKeys
	} from '$lib/member-register/api';
	import { describeRegisterError } from '$lib/member-register/errors';
	import {
		DEFAULT_FILTERS,
		REGISTER_PAGE_SIZE,
		pageToRedirect,
		filtersToSearch,
		hasActiveFilters,
		isRegisterEmpty,
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

	let view = $state('register');

	// The possible-duplicates scan is expensive and not paginated, so it runs only
	// while the Duplicates tab is open, plus ONE seeding fetch for the tab badge
	// (the backend offers no count endpoint). After that the badge keeps the last
	// fetched value; ordinary register writes do not touch this query (its key sits
	// outside `memberRegisterKeys.all`) and merge / unlink / approve-and-link
	// invalidate it explicitly.
	let duplicatesSeeded = $state(false);
	const duplicatesQuery = createQuery(() => ({
		queryKey: memberRegisterKeys.duplicates(slug),
		queryFn: () => listPossibleDuplicates(slug, accessToken),
		enabled: !!accessToken && (view === 'duplicates' || !duplicatesSeeded)
	}));
	$effect(() => {
		if (duplicatesQuery.isSuccess) duplicatesSeeded = true;
	});
	const duplicates = $derived(duplicatesQuery.data ?? []);
	const duplicatesError = $derived(
		duplicatesQuery.error ? describeRegisterError(duplicatesQuery.error, 'save') : null
	);

	const records = $derived(listQuery.data?.results ?? []);
	const total = $derived(listQuery.data?.count ?? 0);
	const pageCount = $derived(Math.max(1, Math.ceil(total / REGISTER_PAGE_SIZE)));
	const rangeFrom = $derived(total === 0 ? 0 : (filters.page - 1) * REGISTER_PAGE_SIZE + 1);
	const rangeTo = $derived(Math.min(filters.page * REGISTER_PAGE_SIZE, total));
	// "Invite all" has nothing to do on an empty register. Only the unfiltered view's
	// count proves emptiness; with a filter on, a zero count says nothing.
	const registerEmpty = $derived(
		listQuery.isSuccess && !listQuery.isPlaceholderData && isRegisterEmpty(total, filters)
	);
	const clock = useNow();
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
	let inviting = $state<MembershipRecordSchema | null>(null);
	let unlinking = $state<MembershipRecordSchema | null>(null);
	let merging = $state<PossibleDuplicateSchema | null>(null);
	let inviteAllOpen = $state(false);
	let exportOpen = $state(false);

	// Every dialog works on the LIVE row (falling back to the opened snapshot), so a
	// refetch after a 409/404 updates the lock rules and the future-date checks.
	const liveEditing = $derived(records.find((r) => r.id === editing?.id) ?? editing);
	const liveEnding = $derived(records.find((r) => r.id === ending?.id) ?? ending);
	const liveDeleting = $derived(records.find((r) => r.id === deleting?.id) ?? deleting);
	const liveInviting = $derived(records.find((r) => r.id === inviting?.id) ?? inviting);
	const liveUnlinking = $derived(records.find((r) => r.id === unlinking?.id) ?? unlinking);
	const unlinkingPresent = $derived(!unlinking || records.some((r) => r.id === unlinking?.id));
	const foundMerging = $derived(
		merging
			? duplicates.find(
					(d) => d.unlinked.id === merging?.unlinked.id && d.linked.id === merging?.linked.id
				)
			: undefined
	);
	const liveMerging = $derived(foundMerging ?? merging);
	const mergingPresent = $derived(!merging || foundMerging !== undefined);
	const editingPresent = $derived(!editing || records.some((r) => r.id === editing?.id));
	const endingPresent = $derived(!ending || records.some((r) => r.id === ending?.id));
	const deletingPresent = $derived(!deleting || records.some((r) => r.id === deleting?.id));
	const invitingPresent = $derived(!inviting || records.some((r) => r.id === inviting?.id));

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
		<Button
			variant="outline"
			aria-disabled={registerEmpty}
			aria-describedby={registerEmpty ? 'invite-all-hint' : undefined}
			class={registerEmpty ? 'cursor-not-allowed opacity-50' : undefined}
			data-testid="invite-all-open"
			onclick={() => {
				if (!registerEmpty) inviteAllOpen = true;
			}}
		>
			<Mail aria-hidden="true" />
			{m['memberRegister.inviteAllOpen']()}
		</Button>
		{#if registerEmpty}
			<span id="invite-all-hint" class="sr-only">{m['memberRegister.inviteAllEmptyHint']()}</span>
		{/if}
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

	<Tabs bind:value={view}>
		<TabsList aria-label={m['memberRegister.viewsLabel']()}>
			<TabsTrigger value="register">{m['memberRegister.tabRegister']()}</TabsTrigger>
			<TabsTrigger value="duplicates" data-testid="tab-duplicates">
				{m['memberRegister.tabDuplicates']()}
				{#if duplicates.length > 0}
					<span
						class="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground"
						data-testid="duplicates-count"
					>
						{duplicates.length}
					</span>
				{/if}
			</TabsTrigger>
		</TabsList>

		<TabsContent value="register" class="space-y-6">
			<RegisterFilters {filters} tiers={allTiers} {timezone} onChange={applyFilters} />

			<section aria-labelledby="register-results-heading" aria-busy={listQuery.isFetching}>
				<h2 id="register-results-heading" class="sr-only">
					{m['memberRegister.resultsHeading']()}
				</h2>

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
						onInvite={(r) => (inviting = r)}
						onUnlink={(r) => (unlinking = r)}
						now={clock.current}
					/>
					<RegisterCards
						{records}
						isOwner={data.isOwner}
						onEdit={openEdit}
						onEnd={(r) => (ending = r)}
						onDelete={(r) => (deleting = r)}
						onInvite={(r) => (inviting = r)}
						onUnlink={(r) => (unlinking = r)}
						now={clock.current}
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
		</TabsContent>

		<TabsContent value="duplicates" class="space-y-4">
			<p class="text-sm text-muted-foreground">{m['memberRegister.duplicatesIntro']()}</p>
			{#if duplicatesQuery.isPending}
				<p class="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{m['memberRegister.loading']()}
				</p>
			{:else if duplicatesError}
				<div class="space-y-3">
					<RegisterErrorAlert error={duplicatesError} />
					<Button variant="outline" onclick={() => duplicatesQuery.refetch()}>
						{m['memberRegister.retry']()}
					</Button>
				</div>
			{:else if duplicates.length === 0}
				<EmptyState
					icon={GitMerge}
					title={m['memberRegister.duplicatesEmptyTitle']()}
					body={m['memberRegister.duplicatesEmptyBody']()}
				/>
			{:else}
				<DuplicatesList pairs={duplicates} onMerge={(pair) => (merging = pair)} />
			{/if}
		</TabsContent>
	</Tabs>
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
<InviteRecordDialog
	open={inviting !== null}
	record={liveInviting}
	recordPresent={invitingPresent}
	{slug}
	{accessToken}
	onClose={() => (inviting = null)}
/>
<InviteAllDialog
	open={inviteAllOpen}
	{slug}
	{accessToken}
	onClose={() => (inviteAllOpen = false)}
/>
<UnlinkRecordDialog
	open={unlinking !== null}
	record={liveUnlinking}
	recordPresent={unlinkingPresent}
	{slug}
	{accessToken}
	onClose={() => (unlinking = null)}
/>
<MergeRecordsDialog
	open={merging !== null}
	pair={liveMerging}
	pairPresent={mergingPresent}
	{slug}
	{accessToken}
	onClose={() => (merging = null)}
/>
