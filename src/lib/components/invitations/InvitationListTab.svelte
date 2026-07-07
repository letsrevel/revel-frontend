<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventInvitationListSchema,
		PendingEventInvitationListSchema,
		TicketTierDetailSchema
	} from '$lib/api/generated/types.gen';
	import { Search, Mail, UserPlus, Plus, Edit } from '@lucide/svelte';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { Button } from '$lib/components/ui/button';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import InvitationTable from './InvitationTable.svelte';
	import InvitationFormDialogs from './InvitationFormDialogs.svelte';

	// Only totalCount is read here; callers pass wider pagination objects.
	interface Pagination {
		totalCount: number;
	}

	interface Props {
		registeredInvitations: EventInvitationListSchema[];
		pendingInvitations: PendingEventInvitationListSchema[];
		registeredPagination: Pagination;
		pendingPagination: Pagination;
		organizationSlug: string;
		accessToken: string | null;
		searchInput: string;
		onSearchInput: (e: Event) => void;
		ticketTiers?: TicketTierDetailSchema[];
	}

	const {
		registeredInvitations,
		pendingInvitations,
		registeredPagination,
		pendingPagination,
		organizationSlug,
		accessToken,
		searchInput,
		onSearchInput,
		ticketTiers = []
	}: Props = $props();

	let processingId = $state<string | null>(null);

	// Bulk selection state (SvelteSet keeps selection reactive — kept in the
	// parent and passed by reference; child tables mutate it in place).
	const selectedRegisteredIds = new SvelteSet<string>();
	const selectedPendingIds = new SvelteSet<string>();

	const totalSelected = $derived(selectedRegisteredIds.size + selectedPendingIds.size);

	let dialogs: InvitationFormDialogs | undefined = $state();

	function clearSelections() {
		selectedRegisteredIds.clear();
		selectedPendingIds.clear();
	}

	function openEdit(
		invitation: EventInvitationListSchema | PendingEventInvitationListSchema,
		type: 'registered' | 'pending'
	) {
		dialogs?.openEdit(invitation, type);
	}
</script>

<div class="space-y-6">
	<!-- Action Buttons -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<p class="text-sm text-muted-foreground">
			{m['eventInvitationsAdmin.directInvitationsDescription']()}
		</p>
		<div class="flex gap-2">
			{#if totalSelected > 0}
				<Button variant="outline" onclick={() => dialogs?.openBulk()}>
					<Edit class="h-4 w-4" aria-hidden="true" />
					{m['eventInvitationsAdmin.editSelected']({ count: totalSelected })}
				</Button>
			{/if}
			<Button onclick={() => dialogs?.openCreate()}>
				<Plus class="h-4 w-4" aria-hidden="true" />
				{m['eventInvitationsAdmin.createInvitations']()}
			</Button>
		</div>
	</div>

	<!-- Search -->
	<div class="relative">
		<Search
			class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<input
			type="search"
			placeholder={m['invitationListTab.searchPlaceholder']()}
			value={searchInput}
			oninput={onSearchInput}
			class="w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		/>
	</div>

	<!-- Registered Invitations -->
	<InvitationTable
		title={m['eventInvitationsAdmin.registeredUsersTitle']({
			count: registeredPagination.totalCount
		})}
		invitations={registeredInvitations}
		selectedIds={selectedRegisteredIds}
		invitationType="registered"
		bind:processingId
		onClear={clearSelections}
		onEdit={openEdit}
		identityHeaders={registeredHeaders}
		identityCells={registeredCells}
		emptyState={registeredEmpty}
	/>

	<!-- Pending Invitations -->
	<InvitationTable
		title={m['eventInvitationsAdmin.pendingUsersTitle']({
			count: pendingPagination.totalCount
		})}
		invitations={pendingInvitations}
		selectedIds={selectedPendingIds}
		invitationType="pending"
		bind:processingId
		onClear={clearSelections}
		onEdit={openEdit}
		identityHeaders={pendingHeaders}
		identityCells={pendingCells}
		emptyState={pendingEmpty}
	/>
</div>

<InvitationFormDialogs
	bind:this={dialogs}
	{organizationSlug}
	{accessToken}
	{registeredInvitations}
	{pendingInvitations}
	{selectedRegisteredIds}
	{selectedPendingIds}
	{ticketTiers}
	onClearSelections={clearSelections}
/>

{#snippet registeredHeaders()}
	<th
		class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
	>
		{m['eventInvitationsAdmin.headerUser']()}
	</th>
	<th
		class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
	>
		{m['eventInvitationsAdmin.headerEmail']()}
	</th>
{/snippet}

{#snippet registeredCells(invitation: EventInvitationListSchema)}
	<!-- User -->
	<td class="px-4 py-4">
		<div class="flex items-center gap-2">
			<UserAvatar
				profilePictureUrl={invitation.user.profile_picture_url}
				previewUrl={invitation.user.profile_picture_preview_url}
				thumbnailUrl={invitation.user.profile_picture_thumbnail_url}
				displayName={getUserDisplayName(invitation.user, m['eventInvitationsAdmin.unknownUser']())}
				firstName={invitation.user.first_name}
				lastName={invitation.user.last_name}
				size="sm"
				clickable={true}
			/>
			<span class="text-sm font-medium">
				{getUserDisplayName(invitation.user, m['eventInvitationsAdmin.unknownUser']())}
			</span>
		</div>
	</td>

	<!-- Email -->
	<td class="px-4 py-4 text-sm text-muted-foreground">
		{invitation.user.email || 'N/A'}
	</td>
{/snippet}

{#snippet registeredEmpty()}
	<UserPlus class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
	<p class="text-sm text-muted-foreground">
		{m['eventInvitationsAdmin.noRegisteredInvitations']()}
	</p>
{/snippet}

{#snippet pendingHeaders()}
	<th
		class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
	>
		{m['eventInvitationsAdmin.headerEmail']()}
	</th>
{/snippet}

{#snippet pendingCells(invitation: PendingEventInvitationListSchema)}
	<!-- Email -->
	<td class="px-4 py-4 text-sm font-medium">{invitation.email}</td>
{/snippet}

{#snippet pendingEmpty()}
	<Mail class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
	<p class="text-sm text-muted-foreground">
		{m['eventInvitationsAdmin.noPendingInvitations']()}
	</p>
{/snippet}
