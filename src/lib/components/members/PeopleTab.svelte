<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { createQuery, keepPreviousData, useQueryClient } from '@tanstack/svelte-query';
	import {
		BookUser,
		ChevronLeft,
		ChevronRight,
		Download,
		Loader2,
		Mail,
		MoreHorizontal
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import type {
		MembershipRecordSchema,
		OrganizationAdminDetailSchema,
		PossibleDuplicateSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { allTiersQueryOptions } from '$lib/queries/membership-tiers';
	import { pendingApplicationsQueryOptions } from '$lib/queries/membership-requests';
	import { standardTiers } from '$lib/utils/membership-tier-kind';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import RegisterFilters from '$lib/components/member-register/RegisterFilters.svelte';
	import RegisterTable from '$lib/components/member-register/RegisterTable.svelte';
	import RegisterCards from '$lib/components/member-register/RegisterCards.svelte';
	import RecordFormDialog from '$lib/components/member-register/RecordFormDialog.svelte';
	import EndRecordDialog from '$lib/components/member-register/EndRecordDialog.svelte';
	import DeleteRecordDialog from '$lib/components/member-register/DeleteRecordDialog.svelte';
	import InviteRecordDialog from '$lib/components/member-register/InviteRecordDialog.svelte';
	import InviteAllDialog from '$lib/components/member-register/InviteAllDialog.svelte';
	import UnlinkRecordDialog from '$lib/components/member-register/UnlinkRecordDialog.svelte';
	import MergeRecordsDialog from '$lib/components/member-register/MergeRecordsDialog.svelte';
	import DuplicatesDialog from '$lib/components/member-register/DuplicatesDialog.svelte';
	import RegisterExportDialog from '$lib/components/member-register/RegisterExportDialog.svelte';
	import PersonSheet from '$lib/components/member-register/PersonSheet.svelte';
	import RegisterErrorAlert from '$lib/components/member-register/RegisterErrorAlert.svelte';
	import PeopleChips from '$lib/components/member-register/PeopleChips.svelte';
	import NeedsAttention from '$lib/components/member-register/NeedsAttention.svelte';
	import AddByAccountDialog from '$lib/components/member-register/AddByAccountDialog.svelte';
	import AddPersonMenu from '$lib/components/member-register/AddPersonMenu.svelte';
	import {
		countRegister,
		listPeople,
		listPossibleDuplicates,
		memberRegisterKeys
	} from '$lib/member-register/api';
	import { describeRegisterError } from '$lib/member-register/errors';
	import {
		DEFAULT_FILTERS,
		REGISTER_PAGE_SIZE,
		isRegisterEmpty,
		pageToRedirect
	} from '$lib/member-register/filters';
	import {
		VIEW_FILTERS,
		parsePeopleFilters,
		peopleQuery,
		peopleFiltersToSearch,
		viewFromFilters,
		type PeopleView
	} from '$lib/member-register/people-view';
	import { nextInviteRefetchDelay } from '$lib/member-register/invite-schedule';
	import {
		sheetStateFor,
		sheetStateForRecord,
		type SheetState
	} from '$lib/member-register/person-target';
	import { createFilterNavigator } from '$lib/member-register/filter-navigator.svelte';
	import { resolveOrgTimezone } from '$lib/member-register/org-timezone';
	import { calendarDayInZone, formatCalendarDay } from '$lib/member-register/calendar-day';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		isOwner: boolean;
		/** Switch to the Applications tab (the "Needs attention" review action). */
		onOpenApplications: () => void;
		/** Open the create-invite-link dialog (the "Add person" menu). */
		onCreateInviteLink: () => void;
		/** Open the Payments tab (shown to staff holding `manage_subscriptions`). */
		onOpenPayments?: () => void;
		/** Open the Tiers tab (the "Add by account" dialog offers it when no standard tier exists). */
		onOpenTiers?: () => void;
		/** Users who are staff: the member actions offer "make staff" only to the rest. */
		staffUserIds: Set<string>;
		/**
		 * False while another tab is showing. The tab stays mounted (its filters and
		 * dialogs survive a round trip) but fires no query and runs no correction
		 * effect, so the duplicates scan, the register list and the applications
		 * count only run while People is on screen.
		 */
		active?: boolean;
	}

	const {
		organization,
		isOwner,
		onOpenApplications,
		onCreateInviteLink,
		onOpenPayments,
		onOpenTiers,
		staffUserIds,
		active = true
	}: Props = $props();

	const slug = $derived(organization.slug);
	const accessToken = $derived(authStore.accessToken);
	const timezone = $derived(resolveOrgTimezone(organization));

	// The URL query is the single source of truth: shareable, and back/forward
	// restores it. The group chip is `?view=`, absent for the default ("Current").
	const filters = $derived(parsePeopleFilters($page.url.searchParams));
	// "Today" on the organization's wall clock: what the Current chip asks for.
	const today = $derived(calendarDayInZone(timezone));
	// Chip -> backend params (one mapping). In "As of" mode every chip filter is
	// dropped: the snapshot is everyone active that day.
	const listParams = $derived(peopleQuery(filters, today));

	const navigator = createFilterNavigator({
		current: () => filters,
		serialize: peopleFiltersToSearch,
		navigate: async (qs, opts) => {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-only update; the relative "?" string keeps the current pathname (resolve() cannot express search params)
			await goto(`?${qs}`, { replaceState: opts.replace, keepFocus: true, noScroll: true });
		},
		onError: () => toast.error(m['memberRegister.filtersApplyError']())
	});
	const intendedFilters = $derived(navigator.intended);
	const activeView = $derived(viewFromFilters(intendedFilters));

	function selectView(view: PeopleView) {
		navigator.patch({ ...VIEW_FILTERS[view], page: 1 });
	}

	// All-kinds tier list for the filter; the create/edit form offers standard tiers.
	const tiersQuery = createQuery(() => ({
		...allTiersQueryOptions(slug, accessToken),
		enabled: active && !!accessToken
	}));
	const allTiers = $derived(tiersQuery.data ?? []);
	const formTiers = $derived(standardTiers(allTiers));

	const listQuery = createQuery(() => ({
		queryKey: memberRegisterKeys.list(slug, listParams),
		queryFn: () => listPeople(slug, accessToken, listParams),
		enabled: active && !!accessToken,
		placeholderData: keepPreviousData
	}));

	// The register's true size, ignoring every filter and chip: only this proves
	// the register itself is empty (the default "Current" chip alone cannot).
	const totalQuery = createQuery(() => ({
		queryKey: memberRegisterKeys.total(slug),
		queryFn: () => countRegister(slug, accessToken),
		enabled: active && !!accessToken
	}));

	// The possible-duplicates scan is expensive and not paginated: it runs ONCE on
	// load (this tab is the only place that auto-fetches it; the backend has no
	// count endpoint), again on each opening of the dialog, and whenever merge /
	// unlink / approve-and-link invalidate it explicitly. Ordinary register writes
	// don't touch it (its key sits outside `memberRegisterKeys.all`). It stays
	// ENABLED so those invalidations refetch it (a disabled query is skipped by
	// refetchQueries); `staleTime: Infinity` plus no focus/reconnect refetch keeps
	// it from scanning in the background.
	const duplicatesQuery = createQuery(() => ({
		queryKey: memberRegisterKeys.duplicates(slug),
		queryFn: () => listPossibleDuplicates(slug, accessToken),
		enabled: active && !!accessToken,
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false
	}));
	let duplicatesOpen = $state(false);
	let wasDuplicatesOpen = false;
	$effect(() => {
		const current = duplicatesOpen;
		if (current && !wasDuplicatesOpen) untrack(() => duplicatesQuery.refetch());
		wasDuplicatesOpen = current;
	});
	const duplicates = $derived(duplicatesQuery.data ?? []);
	const duplicatesError = $derived(
		duplicatesQuery.error ? describeRegisterError(duplicatesQuery.error, 'save') : null
	);

	// Pending applications: a count for "Needs attention", cached with the
	// Applications tab's own default view.
	const applicationsQuery = createQuery(() => ({
		...pendingApplicationsQueryOptions(slug, accessToken),
		enabled: active && !!accessToken
	}));
	const pendingApplications = $derived(applicationsQuery.data?.count ?? 0);

	const records = $derived(listQuery.data?.results ?? []);

	// `can_invite` is computed by the backend when the list is fetched. A row whose
	// start date passes while the page stays open would keep its stale "not yet"
	// state, so schedule ONE refetch for the nearest upcoming start.
	const queryClient = useQueryClient();
	$effect(() => {
		if (!active) return;
		const delay = nextInviteRefetchDelay(records);
		if (delay === null) return;
		const handle = setTimeout(() => {
			void queryClient.invalidateQueries({
				queryKey: memberRegisterKeys.list(slug, listParams)
			});
		}, delay);
		return () => clearTimeout(handle);
	});
	const total = $derived(listQuery.data?.count ?? 0);
	const pageCount = $derived(Math.max(1, Math.ceil(total / REGISTER_PAGE_SIZE)));
	const rangeFrom = $derived(total === 0 ? 0 : (filters.page - 1) * REGISTER_PAGE_SIZE + 1);
	const rangeTo = $derived(Math.min(filters.page * REGISTER_PAGE_SIZE, total));
	// Empty REGISTER (not merely an empty chip): the unfiltered total is zero.
	const registerEmpty = $derived(
		totalQuery.isSuccess && isRegisterEmpty(totalQuery.data ?? 0, DEFAULT_FILTERS)
	);
	const listError = $derived(
		listQuery.error ? describeRegisterError(listQuery.error, 'save') : null
	);

	// A page past the last one (stale `?page=`, or the last row of the last page was
	// deleted) holds no rows although the list is not empty: go to the last page.
	const redirectPage = $derived(
		active && listQuery.isSuccess && !listQuery.isPlaceholderData
			? pageToRedirect(records.length, total, filters.page)
			: null
	);
	// Corrections wait while a filter change is pending: they are computed from the
	// URL's result set, which that change is about to replace.
	$effect(() => {
		if (!active || navigator.isPending) return;
		if (redirectPage !== null) navigator.patch({ page: redirectPage });
	});

	// A well-formed tier id that no longer exists matches nothing: drop the filter and say so.
	$effect(() => {
		if (!active || navigator.isPending) return;
		const tierId = filters.tierId;
		if (tierId && tiersQuery.isSuccess && !allTiers.some((t) => t.id === tierId)) {
			toast.info(m['memberRegister.tierFilterStale']());
			navigator.patch({ tierId: null, page: 1 });
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
	let byAccountOpen = $state(false);

	// Every dialog works on the LIVE row (falling back to the opened snapshot), so a
	// refetch after a 409/404 updates the lock rules and the future-date checks.
	const liveEditing = $derived(records.find((r) => r.id === editing?.id) ?? editing);
	const liveEnding = $derived(records.find((r) => r.id === ending?.id) ?? ending);
	const liveDeleting = $derived(records.find((r) => r.id === deleting?.id) ?? deleting);
	const liveInviting = $derived(records.find((r) => r.id === inviting?.id) ?? inviting);
	const liveUnlinking = $derived(records.find((r) => r.id === unlinking?.id) ?? unlinking);
	const unlinkingPresent = $derived(
		!unlinking || !!unlinking.merged_into_id || records.some((r) => r.id === unlinking?.id)
	);
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

	// The person sheet. A linked person is followed by their USER id (a tier change
	// ends one entry and opens another); an account-less or merged entry is followed
	// by its record id. The sheet resolves the live entry itself. A record-keyed
	// sheet closes when a settled refetch no longer has its row: it was ended into
	// another chip, deleted or unlinked, and there is nothing left to show. A
	// merged entry (opened from a periods list) is never in the list, so it stays.
	let sheet = $state<SheetState | null>(null);
	const sheetRecordId = $derived(
		sheet?.target.kind === 'record' && !sheet.seed.merged_into_id ? sheet.target.recordId : null
	);
	const sheetRowPresent = $derived(!sheetRecordId || records.some((r) => r.id === sheetRecordId));
	$effect(() => {
		if (
			sheet &&
			!sheetRowPresent &&
			listQuery.isSuccess &&
			!listQuery.isFetching &&
			!listQuery.isPlaceholderData
		) {
			sheet = null;
		}
	});

	function openCreate() {
		editing = null;
		formOpen = true;
	}
	function openEdit(record: MembershipRecordSchema) {
		editing = record;
		formOpen = true;
	}
</script>

<div class="space-y-4">
	<NeedsAttention
		duplicatesCount={duplicates.length}
		applicationsCount={pendingApplications}
		onReviewDuplicates={() => (duplicatesOpen = true)}
		onReviewApplications={onOpenApplications}
	/>

	<div class="flex flex-wrap items-start justify-between gap-3">
		{#if !filters.activeOn}
			<PeopleChips value={activeView} onChange={selectView} />
		{:else}
			<p class="text-sm text-muted-foreground" data-testid="people-as-of-note">
				{m['memberPeople.asOfShowing']({ day: formatCalendarDay(filters.activeOn) })}
			</p>
		{/if}
		<div class="flex flex-wrap items-center gap-2">
			<Button variant="outline" onclick={() => (exportOpen = true)} data-testid="people-export">
				<Download aria-hidden="true" />
				{m['memberRegister.exportOpen']()}
			</Button>
			<AddPersonMenu
				onAddToRegister={openCreate}
				onAddByAccount={() => (byAccountOpen = true)}
				{onCreateInviteLink}
			/>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="outline"
							size="icon"
							aria-label={m['memberPeople.moreActions']()}
							data-testid="people-more"
						>
							<MoreHorizontal aria-hidden="true" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item
						disabled={registerEmpty}
						data-testid="invite-all-open"
						onclick={() => (inviteAllOpen = true)}
					>
						<Mail aria-hidden="true" />
						{m['memberRegister.inviteAllOpen']()}
					</DropdownMenu.Item>
					{#if registerEmpty}
						<DropdownMenu.Label class="max-w-64 text-xs font-normal text-muted-foreground">
							{m['memberRegister.inviteAllEmptyHint']()}
						</DropdownMenu.Label>
					{/if}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	<RegisterFilters
		filters={intendedFilters}
		tiers={allTiers}
		{timezone}
		onChange={navigator.patch}
	/>

	<section aria-labelledby="register-results-heading" aria-busy={listQuery.isFetching}>
		<h2 id="register-results-heading" class="sr-only">
			{m['memberRegister.resultsHeading']()}
		</h2>

		{#if listQuery.isPending || (records.length === 0 && totalQuery.isPending)}
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
				title={registerEmpty
					? m['memberRegister.emptyTitle']()
					: m['memberRegister.emptyFilteredTitle']()}
				body={registerEmpty
					? m['memberRegister.emptyBody']()
					: m['memberRegister.emptyFilteredBody']()}
			>
				{#snippet action()}
					{#if !registerEmpty}
						<Button
							variant="outline"
							onclick={() =>
								navigator.patch({
									...VIEW_FILTERS.everyone,
									tierId: null,
									activeOn: null,
									search: '',
									page: 1
								})}
						>
							{m['memberPeople.showEveryone']()}
						</Button>
					{:else}
						<Button onclick={openCreate}>{m['memberPeople.addToRegister']()}</Button>
					{/if}
				{/snippet}
			</EmptyState>
		{:else}
			<RegisterTable
				{records}
				{isOwner}
				onEdit={openEdit}
				onEnd={(r) => (ending = r)}
				onDelete={(r) => (deleting = r)}
				onInvite={(r) => (inviting = r)}
				onUnlink={(r) => (unlinking = r)}
				onOpen={(r) => (sheet = sheetStateFor(r))}
			/>
			<RegisterCards
				{records}
				{isOwner}
				onEdit={openEdit}
				onEnd={(r) => (ending = r)}
				onDelete={(r) => (deleting = r)}
				onInvite={(r) => (inviting = r)}
				onUnlink={(r) => (unlinking = r)}
				onOpen={(r) => (sheet = sheetStateFor(r))}
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
						onclick={() => navigator.patch({ page: intendedFilters.page - 1 }, { push: true })}
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
						onclick={() => navigator.patch({ page: intendedFilters.page + 1 }, { push: true })}
					>
						{m['memberRegister.next']()}
						<ChevronRight aria-hidden="true" />
					</Button>
				</div>
			</nav>
		{/if}
	</section>
</div>

<PersonSheet
	{sheet}
	rows={records}
	{slug}
	{accessToken}
	tiers={formTiers}
	{staffUserIds}
	{isOwner}
	canOpenPayments={!!onOpenPayments}
	onClose={() => (sheet = null)}
	onOpenRecord={(r) => (sheet = sheetStateForRecord(r))}
	onEdit={openEdit}
	onEnd={(r) => (ending = r)}
	onDelete={(r) => (deleting = r)}
	onInvite={(r) => (inviting = r)}
	onUnlink={(r) => {
		unlinking = r;
		// A merged entry is not in the list: once unlinked it is a different row, so
		// the sheet closes rather than keep showing the stale merged snapshot.
		if (r.merged_into_id) sheet = null;
	}}
	onOpenPayments={() => {
		sheet = null;
		onOpenPayments?.();
	}}
/>
<AddByAccountDialog
	open={byAccountOpen}
	{slug}
	{accessToken}
	tiers={formTiers}
	onClose={() => (byAccountOpen = false)}
	onOpenPerson={(seed) => (sheet = sheetStateFor(seed))}
	{onOpenApplications}
	{onCreateInviteLink}
	{onOpenTiers}
/>
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
<DuplicatesDialog
	open={duplicatesOpen}
	pairs={duplicates}
	isPending={duplicatesQuery.isPending}
	error={duplicatesError}
	onRetry={() => duplicatesQuery.refetch()}
	onMerge={(pair) => (merging = pair)}
	onClose={() => (duplicatesOpen = false)}
/>
<MergeRecordsDialog
	open={merging !== null}
	pair={liveMerging}
	pairPresent={mergingPresent}
	{slug}
	{accessToken}
	onClose={() => (merging = null)}
/>
