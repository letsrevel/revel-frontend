<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventInvitationListSchema,
		PendingEventInvitationListSchema
	} from '$lib/api/generated/types.gen';
	import { enhance } from '$app/forms';
	import {
		Search,
		Mail,
		UserPlus,
		Trash2,
		Plus,
		Edit,
		CheckSquare,
		Square
	} from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import EmailTagInput from '$lib/components/forms/EmailTagInput.svelte';

	interface Pagination {
		page: number;
		pageSize: number;
		totalCount: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
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
	}

	let {
		registeredInvitations,
		pendingInvitations,
		registeredPagination,
		pendingPagination,
		organizationSlug,
		accessToken,
		searchInput,
		onSearchInput
	}: Props = $props();

	let processingId = $state<string | null>(null);

	// Create invitation form state
	let showCreateDialog = $state(false);
	let invitationEmails = $state('');
	let invitationMessage = $state('');
	let emailTags = $state<string[]>([]);

	// Edit invitation state
	let showEditDialog = $state(false);
	let editingInvitation = $state<
		EventInvitationListSchema | PendingEventInvitationListSchema | null
	>(null);
	let editingType = $state<'registered' | 'pending' | null>(null);
	let editFormData = $state({
		waives_questionnaire: false,
		waives_purchase: false,
		waives_membership_required: false,
		waives_rsvp_deadline: false,
		overrides_max_attendees: false,
		custom_message: ''
	});

	// Bulk selection state
	let selectedRegisteredIds = $state<Set<string>>(new Set());
	let selectedPendingIds = $state<Set<string>>(new Set());
	let showBulkEditDialog = $state(false);
	let bulkEditFormData = $state({
		waives_questionnaire: false,
		waives_purchase: false,
		waives_membership_required: false,
		waives_rsvp_deadline: false,
		overrides_max_attendees: false,
		custom_message: ''
	});

	let totalSelected = $derived(selectedRegisteredIds.size + selectedPendingIds.size);

	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			return formatDistanceToNow(date, { addSuffix: true });
		} catch {
			return dateString;
		}
	}

	function resetCreateForm() {
		invitationEmails = '';
		invitationMessage = '';
		emailTags = [];
	}

	function openEditDialog(
		invitation: EventInvitationListSchema | PendingEventInvitationListSchema,
		type: 'registered' | 'pending'
	) {
		editingInvitation = invitation;
		editingType = type;
		editFormData = {
			waives_questionnaire: invitation.waives_questionnaire,
			waives_purchase: invitation.waives_purchase,
			waives_membership_required: invitation.waives_membership_required,
			waives_rsvp_deadline: invitation.waives_rsvp_deadline,
			overrides_max_attendees: invitation.overrides_max_attendees,
			custom_message: invitation.custom_message || ''
		};
		showEditDialog = true;
	}

	function resetEditForm() {
		editingInvitation = null;
		editingType = null;
		editFormData = {
			waives_questionnaire: false,
			waives_purchase: false,
			waives_membership_required: false,
			waives_rsvp_deadline: false,
			overrides_max_attendees: false,
			custom_message: ''
		};
	}

	function toggleRegisteredSelection(id: string) {
		const newSet = new Set(selectedRegisteredIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedRegisteredIds = newSet;
	}

	function togglePendingSelection(id: string) {
		const newSet = new Set(selectedPendingIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedPendingIds = newSet;
	}

	function toggleSelectAllRegistered() {
		if (selectedRegisteredIds.size === registeredInvitations.length) {
			selectedRegisteredIds = new Set();
		} else {
			selectedRegisteredIds = new Set(registeredInvitations.map((inv) => inv.id));
		}
	}

	function toggleSelectAllPending() {
		if (selectedPendingIds.size === pendingInvitations.length) {
			selectedPendingIds = new Set();
		} else {
			selectedPendingIds = new Set(pendingInvitations.map((inv) => inv.id));
		}
	}

	function openBulkEditDialog() {
		bulkEditFormData = {
			waives_questionnaire: false,
			waives_purchase: false,
			waives_membership_required: false,
			waives_rsvp_deadline: false,
			overrides_max_attendees: false,
			custom_message: ''
		};
		showBulkEditDialog = true;
	}

	function resetBulkEditForm() {
		bulkEditFormData = {
			waives_questionnaire: false,
			waives_purchase: false,
			waives_membership_required: false,
			waives_rsvp_deadline: false,
			overrides_max_attendees: false,
			custom_message: ''
		};
	}

	function clearSelections() {
		selectedRegisteredIds = new Set();
		selectedPendingIds = new Set();
	}

	function handleEmailTagsChange(tags: string[]) {
		emailTags = tags;
		invitationEmails = tags.join('\n');
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
				<Button variant="outline" onclick={openBulkEditDialog}>
					<Edit class="h-4 w-4" aria-hidden="true" />
					{m['eventInvitationsAdmin.editSelected']({ count: totalSelected })}
				</Button>
			{/if}
			<Button onclick={() => (showCreateDialog = true)}>
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
			placeholder="Search by name or email..."
			value={searchInput}
			oninput={onSearchInput}
			class="w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		/>
	</div>

	<!-- Registered Invitations -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold">
				{m['eventInvitationsAdmin.registeredUsersTitle']({
					count: registeredPagination.totalCount
				})}
			</h3>
			{#if selectedRegisteredIds.size > 0}
				<div class="flex items-center gap-2">
					<span class="text-sm text-muted-foreground">
						{m['eventInvitationsAdmin.selected']({ count: selectedRegisteredIds.size })}
					</span>
					<Button size="sm" variant="outline" onclick={clearSelections}
						>{m['eventInvitationsAdmin.clear']()}</Button
					>
				</div>
			{/if}
		</div>

		{#if registeredInvitations.length === 0}
			<div class="rounded-lg border bg-card p-8 text-center">
				<UserPlus class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
				<p class="text-sm text-muted-foreground">
					{m['eventInvitationsAdmin.noRegisteredInvitations']()}
				</p>
			</div>
		{:else}
			<div class="overflow-hidden rounded-lg border bg-card">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="border-b bg-muted/50">
							<tr>
								<th class="w-12 px-4 py-3">
									<button
										type="button"
										onclick={toggleSelectAllRegistered}
										class="flex items-center justify-center text-muted-foreground hover:text-foreground"
									>
										{#if selectedRegisteredIds.size === registeredInvitations.length && registeredInvitations.length > 0}
											<CheckSquare class="h-4 w-4" aria-hidden="true" />
										{:else}
											<Square class="h-4 w-4" aria-hidden="true" />
										{/if}
									</button>
								</th>
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
								<th
									class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
								>
									{m['eventInvitationsAdmin.headerProperties']()}
								</th>
								<th
									class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
								>
									{m['eventInvitationsAdmin.headerCreated']()}
								</th>
								<th
									class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
								>
									{m['eventInvitationsAdmin.headerActions']()}
								</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{#each registeredInvitations as invitation (invitation.id)}
								<tr class="transition-colors hover:bg-muted/50">
									<!-- Checkbox -->
									<td class="px-4 py-4">
										<button
											type="button"
											onclick={() => toggleRegisteredSelection(invitation.id)}
											class="flex items-center justify-center text-muted-foreground hover:text-foreground"
										>
											{#if selectedRegisteredIds.has(invitation.id)}
												<CheckSquare class="h-4 w-4" aria-hidden="true" />
											{:else}
												<Square class="h-4 w-4" aria-hidden="true" />
											{/if}
										</button>
									</td>

									<!-- User -->
									<td class="px-4 py-4">
										<div class="flex items-center gap-2">
											<UserAvatar
												profilePictureUrl={invitation.user.profile_picture_url}
												previewUrl={invitation.user.profile_picture_preview_url}
												thumbnailUrl={invitation.user.profile_picture_thumbnail_url}
												displayName={getUserDisplayName(
													invitation.user,
													m['eventInvitationsAdmin.unknownUser']()
												)}
												firstName={invitation.user.first_name}
												lastName={invitation.user.last_name}
												size="sm"
												clickable={true}
											/>
											<span class="text-sm font-medium">
												{getUserDisplayName(
													invitation.user,
													m['eventInvitationsAdmin.unknownUser']()
												)}
											</span>
										</div>
									</td>

									<!-- Email -->
									<td class="px-4 py-4 text-sm text-muted-foreground">
										{invitation.user.email || 'N/A'}
									</td>

									<!-- Properties -->
									<td class="px-4 py-4">
										{@render invitationProperties(invitation)}
									</td>

									<!-- Created -->
									<td class="px-4 py-4 text-sm text-muted-foreground">
										{formatDate(invitation.created_at)}
									</td>

									<!-- Actions -->
									<td class="px-4 py-4 text-right">
										<div class="flex items-center justify-end gap-2">
											<button
												type="button"
												onclick={() => openEditDialog(invitation, 'registered')}
												class="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
											>
												<Edit class="h-3 w-3" aria-hidden="true" />
												{m['eventInvitationsAdmin.edit']()}
											</button>
											<form
												method="POST"
												action="?/deleteInvitation"
												use:enhance={() => {
													processingId = invitation.id;
													return async ({ update }) => {
														await update();
														processingId = null;
														selectedRegisteredIds.delete(invitation.id);
													};
												}}
											>
												<input type="hidden" name="invitation_id" value={invitation.id} />
												<input type="hidden" name="invitation_type" value="registered" />
												<button
													type="submit"
													disabled={processingId === invitation.id}
													class="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
												>
													<Trash2 class="h-3 w-3" aria-hidden="true" />
													{m['eventInvitationsAdmin.delete']()}
												</button>
											</form>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>

	<!-- Pending Invitations -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold">
				{m['eventInvitationsAdmin.pendingUsersTitle']({
					count: pendingPagination.totalCount
				})}
			</h3>
			{#if selectedPendingIds.size > 0}
				<div class="flex items-center gap-2">
					<span class="text-sm text-muted-foreground">
						{m['eventInvitationsAdmin.selected']({ count: selectedPendingIds.size })}
					</span>
					<Button size="sm" variant="outline" onclick={clearSelections}
						>{m['eventInvitationsAdmin.clear']()}</Button
					>
				</div>
			{/if}
		</div>

		{#if pendingInvitations.length === 0}
			<div class="rounded-lg border bg-card p-8 text-center">
				<Mail class="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
				<p class="text-sm text-muted-foreground">
					{m['eventInvitationsAdmin.noPendingInvitations']()}
				</p>
			</div>
		{:else}
			<div class="overflow-hidden rounded-lg border bg-card">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="border-b bg-muted/50">
							<tr>
								<th class="w-12 px-4 py-3">
									<button
										type="button"
										onclick={toggleSelectAllPending}
										class="flex items-center justify-center text-muted-foreground hover:text-foreground"
									>
										{#if selectedPendingIds.size === pendingInvitations.length && pendingInvitations.length > 0}
											<CheckSquare class="h-4 w-4" aria-hidden="true" />
										{:else}
											<Square class="h-4 w-4" aria-hidden="true" />
										{/if}
									</button>
								</th>
								<th
									class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
								>
									{m['eventInvitationsAdmin.headerEmail']()}
								</th>
								<th
									class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
								>
									{m['eventInvitationsAdmin.headerProperties']()}
								</th>
								<th
									class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
								>
									{m['eventInvitationsAdmin.headerCreated']()}
								</th>
								<th
									class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
								>
									{m['eventInvitationsAdmin.headerActions']()}
								</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{#each pendingInvitations as invitation (invitation.id)}
								<tr class="transition-colors hover:bg-muted/50">
									<!-- Checkbox -->
									<td class="px-4 py-4">
										<button
											type="button"
											onclick={() => togglePendingSelection(invitation.id)}
											class="flex items-center justify-center text-muted-foreground hover:text-foreground"
										>
											{#if selectedPendingIds.has(invitation.id)}
												<CheckSquare class="h-4 w-4" aria-hidden="true" />
											{:else}
												<Square class="h-4 w-4" aria-hidden="true" />
											{/if}
										</button>
									</td>

									<!-- Email -->
									<td class="px-4 py-4 text-sm font-medium">{invitation.email}</td>

									<!-- Properties -->
									<td class="px-4 py-4">
										{@render invitationProperties(invitation)}
									</td>

									<!-- Created -->
									<td class="px-4 py-4 text-sm text-muted-foreground">
										{formatDate(invitation.created_at)}
									</td>

									<!-- Actions -->
									<td class="px-4 py-4 text-right">
										<div class="flex items-center justify-end gap-2">
											<button
												type="button"
												onclick={() => openEditDialog(invitation, 'pending')}
												class="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
											>
												<Edit class="h-3 w-3" aria-hidden="true" />
												{m['eventInvitationsAdmin.edit']()}
											</button>
											<form
												method="POST"
												action="?/deleteInvitation"
												use:enhance={() => {
													processingId = invitation.id;
													return async ({ update }) => {
														await update();
														processingId = null;
														selectedPendingIds.delete(invitation.id);
													};
												}}
											>
												<input type="hidden" name="invitation_id" value={invitation.id} />
												<input type="hidden" name="invitation_type" value="pending" />
												<button
													type="submit"
													disabled={processingId === invitation.id}
													class="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
												>
													<Trash2 class="h-3 w-3" aria-hidden="true" />
													{m['eventInvitationsAdmin.delete']()}
												</button>
											</form>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Create Invitation Dialog -->
<Dialog.Root open={showCreateDialog} onOpenChange={(open) => (showCreateDialog = open)}>
	<Dialog.Content class="sm:max-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>{m['eventInvitationsAdmin.createInvitations']()}</Dialog.Title>
			<Dialog.Description>
				{m['eventInvitationsAdmin.createDialogDescription']()}
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/createInvitations"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					resetCreateForm();
					showCreateDialog = false;
				};
			}}
			class="space-y-4"
		>
			<!-- Hidden email input for form submission -->
			<input type="hidden" name="emails" value={invitationEmails} />

			<!-- Email addresses with tag input -->
			<EmailTagInput
				{emailTags}
				{organizationSlug}
				{accessToken}
				placeholder={m['eventInvitationsAdmin.emailPlaceholder']()}
				onTagsChange={handleEmailTagsChange}
			/>

			<!-- Custom message -->
			<div>
				<label for="custom_message" class="block text-sm font-medium">
					{m['eventInvitationsAdmin.customMessageLabel']()}
				</label>
				<textarea
					id="custom_message"
					name="custom_message"
					bind:value={invitationMessage}
					placeholder={m['eventInvitationsAdmin.customMessagePlaceholder']()}
					rows="3"
					maxlength="500"
					class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				></textarea>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['eventInvitationsAdmin.charactersCount']({ count: invitationMessage.length })}
				</p>
			</div>

			<!-- Invitation properties -->
			{@render invitationPropertiesCheckboxes()}

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showCreateDialog = false)}>
					{m['eventInvitationsAdmin.cancel']()}
				</Button>
				<Button type="submit">
					<Mail class="mr-2 h-4 w-4" aria-hidden="true" />
					{m['eventInvitationsAdmin.sendInvitations']()}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Invitation Dialog -->
<Dialog.Root
	open={showEditDialog}
	onOpenChange={(open) => {
		showEditDialog = open;
		if (!open) resetEditForm();
	}}
>
	<Dialog.Content class="sm:max-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>{m['eventInvitationsAdmin.editDialogTitle']()}</Dialog.Title>
			<Dialog.Description>
				{#if editingInvitation}
					{#if editingType === 'registered' && 'user' in editingInvitation}
						{m['eventInvitationsAdmin.editDialogDescriptionUser']({
							userName: getUserDisplayName(
								editingInvitation.user,
								m['eventInvitationsAdmin.unknownUser']()
							)
						})}
					{:else if editingType === 'pending' && 'email' in editingInvitation}
						{m['eventInvitationsAdmin.editDialogDescriptionEmail']({
							email: editingInvitation.email
						})}
					{/if}
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/updateInvitation"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					resetEditForm();
					showEditDialog = false;
				};
			}}
			class="space-y-4"
		>
			{#if editingInvitation}
				<!-- Hidden email field -->
				{#if editingType === 'registered' && 'user' in editingInvitation}
					<input type="hidden" name="email" value={editingInvitation.user.email || ''} />
				{:else if editingType === 'pending' && 'email' in editingInvitation}
					<input type="hidden" name="email" value={editingInvitation.email} />
				{/if}

				<!-- Custom message -->
				<div>
					<label for="edit_custom_message" class="block text-sm font-medium">
						{m['eventInvitationsAdmin.customMessageLabel']()}
					</label>
					<textarea
						id="edit_custom_message"
						name="custom_message"
						bind:value={editFormData.custom_message}
						placeholder={m['eventInvitationsAdmin.customMessagePlaceholder']()}
						rows="3"
						maxlength="500"
						class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					></textarea>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['eventInvitationsAdmin.charactersCount']({
							count: editFormData.custom_message.length
						})}
					</p>
				</div>

				<!-- Invitation properties -->
				<div class="space-y-3 rounded-lg border border-border p-4">
					<h4 class="text-sm font-semibold">{m['eventInvitationsAdmin.propertiesTitle']()}</h4>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_questionnaire"
							value="true"
							bind:checked={editFormData.waives_questionnaire}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">{m['eventInvitationsAdmin.waiveQuestionnaire']()}</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_purchase"
							value="true"
							bind:checked={editFormData.waives_purchase}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">{m['eventInvitationsAdmin.waivePurchase']()}</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_membership_required"
							value="true"
							bind:checked={editFormData.waives_membership_required}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">{m['eventInvitationsAdmin.waiveMembership']()}</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="waives_rsvp_deadline"
							value="true"
							bind:checked={editFormData.waives_rsvp_deadline}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">{m['eventInvitationsAdmin.waiveDeadline']()}</span>
					</label>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							name="overrides_max_attendees"
							value="true"
							bind:checked={editFormData.overrides_max_attendees}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
						<span class="text-sm">{m['eventInvitationsAdmin.overrideMaxAttendees']()}</span>
					</label>
				</div>
			{/if}

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showEditDialog = false)}>
					{m['eventInvitationsAdmin.cancel']()}
				</Button>
				<Button type="submit">
					<Edit class="mr-2 h-4 w-4" aria-hidden="true" />
					{m['eventInvitationsAdmin.updateInvitation']()}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Bulk Edit Dialog -->
<Dialog.Root
	open={showBulkEditDialog}
	onOpenChange={(open) => {
		showBulkEditDialog = open;
		if (!open) resetBulkEditForm();
	}}
>
	<Dialog.Content class="sm:max-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>{m['eventInvitationsAdmin.bulkEditDialogTitle']()}</Dialog.Title>
			<Dialog.Description>
				{m['eventInvitationsAdmin.bulkEditDialogDescription']({
					count: totalSelected,
					plural: totalSelected === 1 ? '' : 's'
				})}
			</Dialog.Description>
		</Dialog.Header>

		<form
			method="POST"
			action="?/bulkUpdateInvitations"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					resetBulkEditForm();
					showBulkEditDialog = false;
					clearSelections();
				};
			}}
			class="space-y-4"
		>
			<!-- Hidden emails field (JSON array) -->
			<input
				type="hidden"
				name="emails"
				value={JSON.stringify([
					...Array.from(selectedRegisteredIds)
						.map((id) => registeredInvitations.find((inv) => inv.id === id)?.user?.email)
						.filter((e) => e),
					...Array.from(selectedPendingIds)
						.map((id) => pendingInvitations.find((inv) => inv.id === id)?.email)
						.filter((e) => e)
				])}
			/>

			<!-- Custom message -->
			<div>
				<label for="bulk_custom_message" class="block text-sm font-medium">
					{m['eventInvitationsAdmin.customMessageLabel']()}
				</label>
				<textarea
					id="bulk_custom_message"
					name="custom_message"
					bind:value={bulkEditFormData.custom_message}
					placeholder={m['eventInvitationsAdmin.customMessagePlaceholder']()}
					rows="3"
					maxlength="500"
					class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				></textarea>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['eventInvitationsAdmin.charactersCount']({
						count: bulkEditFormData.custom_message.length
					})}
				</p>
			</div>

			<!-- Invitation properties -->
			<div class="space-y-3 rounded-lg border border-border p-4">
				<h4 class="text-sm font-semibold">{m['eventInvitationsAdmin.propertiesTitle']()}</h4>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_questionnaire"
						value="true"
						bind:checked={bulkEditFormData.waives_questionnaire}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waiveQuestionnaire']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_purchase"
						value="true"
						bind:checked={bulkEditFormData.waives_purchase}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waivePurchase']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_membership_required"
						value="true"
						bind:checked={bulkEditFormData.waives_membership_required}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waiveMembership']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="waives_rsvp_deadline"
						value="true"
						bind:checked={bulkEditFormData.waives_rsvp_deadline}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.waiveDeadline']()}</span>
				</label>

				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						name="overrides_max_attendees"
						value="true"
						bind:checked={bulkEditFormData.overrides_max_attendees}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<span class="text-sm">{m['eventInvitationsAdmin.overrideMaxAttendees']()}</span>
				</label>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (showBulkEditDialog = false)}>
					{m['eventInvitationsAdmin.cancel']()}
				</Button>
				<Button type="submit">
					<Edit class="mr-2 h-4 w-4" aria-hidden="true" />
					{m['eventInvitationsAdmin.updateInvitations']({
						count: totalSelected,
						plural: totalSelected === 1 ? '' : 's'
					})}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

{#snippet invitationProperties(
	invitation: EventInvitationListSchema | PendingEventInvitationListSchema
)}
	<div class="flex flex-wrap gap-1">
		{#if invitation.waives_questionnaire}
			<span
				class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
				title="Waives questionnaire requirement"
			>
				{m['eventInvitationsAdmin.noQuestionnaire']()}
			</span>
		{/if}
		{#if invitation.waives_purchase}
			<span
				class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
				title="Waives purchase requirement (free ticket)"
			>
				{m['eventInvitationsAdmin.free']()}
			</span>
		{/if}
		{#if invitation.waives_membership_required}
			<span
				class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-200"
				title="Waives membership requirement"
			>
				{m['eventInvitationsAdmin.noMembership']()}
			</span>
		{/if}
		{#if invitation.waives_rsvp_deadline}
			<span
				class="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200"
				title="Waives RSVP deadline"
			>
				{m['eventInvitationsAdmin.noDeadline']()}
			</span>
		{/if}
		{#if invitation.overrides_max_attendees}
			<span
				class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200"
				title="Overrides max attendees limit"
			>
				{m['eventInvitationsAdmin.overrideCap']()}
			</span>
		{/if}
		{#if invitation.custom_message}
			<span
				class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900 dark:text-gray-200"
				title={invitation.custom_message}
			>
				Has {m['eventInvitationsAdmin.headerMessage']()}
			</span>
		{/if}
	</div>
{/snippet}

{#snippet invitationPropertiesCheckboxes()}
	<div class="space-y-3 rounded-lg border border-border p-4">
		<h4 class="text-sm font-semibold">{m['eventInvitationsAdmin.propertiesTitle']()}</h4>

		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				name="waives_questionnaire"
				value="true"
				class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
			/>
			<span class="text-sm">{m['eventInvitationsAdmin.waiveQuestionnaire']()}</span>
		</label>

		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				name="waives_purchase"
				value="true"
				class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
			/>
			<span class="text-sm">{m['eventInvitationsAdmin.waivePurchase']()}</span>
		</label>

		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				name="waives_membership_required"
				value="true"
				class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
			/>
			<span class="text-sm">{m['eventInvitationsAdmin.waiveMembership']()}</span>
		</label>

		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				name="waives_rsvp_deadline"
				value="true"
				class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
			/>
			<span class="text-sm">{m['eventInvitationsAdmin.waiveDeadline']()}</span>
		</label>

		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				name="overrides_max_attendees"
				value="true"
				class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
			/>
			<span class="text-sm">{m['eventInvitationsAdmin.overrideMaxAttendees']()}</span>
		</label>
	</div>
{/snippet}
