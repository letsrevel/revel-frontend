<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventInvitationListSchema,
		PendingEventInvitationListSchema,
		TicketTierDetailSchema
	} from '$lib/api/generated/types.gen';
	import type { SvelteSet } from 'svelte/reactivity';
	import { enhance } from '$app/forms';
	import { Mail, Edit } from '@lucide/svelte';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import EmailTagInput from '$lib/components/forms/EmailTagInput.svelte';

	interface Props {
		organizationSlug: string;
		accessToken: string | null;
		registeredInvitations: EventInvitationListSchema[];
		pendingInvitations: PendingEventInvitationListSchema[];
		selectedRegisteredIds: SvelteSet<string>;
		selectedPendingIds: SvelteSet<string>;
		onClearSelections: () => void;
		ticketTiers?: TicketTierDetailSchema[];
	}

	const {
		organizationSlug,
		accessToken,
		registeredInvitations,
		pendingInvitations,
		selectedRegisteredIds,
		selectedPendingIds,
		onClearSelections,
		ticketTiers = []
	}: Props = $props();

	// Create invitation form state
	let showCreateDialog = $state(false);
	let invitationEmails = $state('');
	let invitationMessage = $state('');
	let emailTags = $state<string[]>([]);
	let createTierIds = $state<string[]>([]);

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
		custom_message: '',
		tier_ids: [] as string[]
	});

	// Bulk edit state
	let showBulkEditDialog = $state(false);
	let bulkEditFormData = $state({
		waives_questionnaire: false,
		waives_purchase: false,
		waives_membership_required: false,
		waives_rsvp_deadline: false,
		overrides_max_attendees: false,
		custom_message: '',
		tier_ids: [] as string[]
	});

	const totalSelected = $derived(selectedRegisteredIds.size + selectedPendingIds.size);

	function resetCreateForm() {
		invitationEmails = '';
		invitationMessage = '';
		emailTags = [];
		createTierIds = [];
	}

	export function openCreate() {
		showCreateDialog = true;
	}

	export function openEdit(
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
			custom_message: invitation.custom_message || '',
			tier_ids: invitation.tiers?.map((t) => t.id) ?? []
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
			custom_message: '',
			tier_ids: []
		};
	}

	export function openBulk() {
		bulkEditFormData = {
			waives_questionnaire: false,
			waives_purchase: false,
			waives_membership_required: false,
			waives_rsvp_deadline: false,
			overrides_max_attendees: false,
			custom_message: '',
			tier_ids: []
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
			custom_message: '',
			tier_ids: []
		};
	}

	function handleEmailTagsChange(tags: string[]) {
		emailTags = tags;
		invitationEmails = tags.join('\n');
	}
</script>

<!-- Create Invitation Dialog -->
<Dialog.Root open={showCreateDialog} onOpenChange={(open) => (showCreateDialog = open)}>
	<Dialog.Content class="flex max-h-[90dvh] flex-col sm:max-w-[600px]">
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
			class="flex min-h-0 flex-1 flex-col gap-4"
		>
			<div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
				<!-- Hidden inputs for form submission -->
				<input type="hidden" name="emails" value={invitationEmails} />
				<input type="hidden" name="tier_ids" value={JSON.stringify(createTierIds)} />

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

				<!-- Ticket tier selection -->
				{@render tierCheckboxes(createTierIds, (ids) => (createTierIds = ids))}
			</div>

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
	<Dialog.Content class="flex max-h-[90dvh] flex-col sm:max-w-[600px]">
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
			class="flex min-h-0 flex-1 flex-col gap-4"
		>
			<div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
				<input type="hidden" name="tier_ids" value={JSON.stringify(editFormData.tier_ids)} />

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

					<!-- Ticket tier selection -->
					{@render tierCheckboxes(editFormData.tier_ids, (ids) => (editFormData.tier_ids = ids))}
				{/if}
			</div>

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
	<Dialog.Content class="flex max-h-[90dvh] flex-col sm:max-w-[600px]">
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
					onClearSelections();
				};
			}}
			class="flex min-h-0 flex-1 flex-col gap-4"
		>
			<div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
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
				<input type="hidden" name="tier_ids" value={JSON.stringify(bulkEditFormData.tier_ids)} />

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

				<!-- Ticket tier selection -->
				{@render tierCheckboxes(
					bulkEditFormData.tier_ids,
					(ids) => (bulkEditFormData.tier_ids = ids)
				)}
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

{#snippet tierCheckboxes(selectedIds: string[], onUpdate: (ids: string[]) => void)}
	{#if ticketTiers.length > 0}
		<div class="space-y-3 rounded-lg border border-border p-4">
			<h4 class="text-sm font-semibold">{m['invitationListTab.assignTicketTiersTitle']()}</h4>
			<p class="text-xs text-muted-foreground">
				{m['invitationListTab.assignTicketTiersDescription']()}
			</p>
			{#each ticketTiers as tier (tier.id ?? tier.name)}
				{#if tier.id}
					<label class="flex cursor-pointer items-start gap-2">
						<input
							type="checkbox"
							checked={selectedIds.includes(tier.id)}
							onchange={(e) => {
								const checked = e.currentTarget.checked;
								if (checked && tier.id && !selectedIds.includes(tier.id)) {
									onUpdate([...selectedIds, tier.id]);
								} else if (!checked && tier.id) {
									onUpdate(selectedIds.filter((id) => id !== tier.id));
								}
							}}
							class="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary"
						/>
						<div class="flex-1">
							<span class="text-sm font-medium">{tier.name}</span>
						</div>
					</label>
				{/if}
			{/each}
		</div>
	{/if}
{/snippet}
