<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import MemberCombobox from '$lib/components/members/MemberCombobox.svelte';
	import type {
		OrganizationAdminDetailSchema,
		OrganizationMemberSchema
	} from '$lib/api/generated/types.gen';

	interface Props {
		open: boolean;
		organization: OrganizationAdminDetailSchema;
		isPending: boolean;
		onSubmit: (userId: string, status: 'yes' | 'maybe' | 'no') => void;
		onCancel: () => void;
	}

	let { open = $bindable(), organization, isPending, onSubmit, onCancel }: Props = $props();

	let selectedMember = $state<OrganizationMemberSchema | null>(null);
	let selectedStatus = $state<'yes' | 'maybe' | 'no'>('yes');

	// Reset the form whenever the dialog is (re)opened
	$effect(() => {
		if (open) {
			selectedMember = null;
			selectedStatus = 'yes';
		}
	});

	const selectedUserId = $derived(selectedMember?.user.id ?? null);

	function handleSubmit() {
		if (!selectedUserId) return;
		onSubmit(selectedUserId, selectedStatus);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{m['attendeesAdmin.createModalTitle']()}</Dialog.Title>
			<Dialog.Description>
				{m['attendeesAdmin.createModalDescription']()}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<!-- Member selection -->
			<div class="space-y-2">
				<Label for="create-rsvp-member">{m['attendeesAdmin.createModalMemberLabel']()}</Label>
				<MemberCombobox
					id="create-rsvp-member"
					{organization}
					value={selectedMember}
					onSelect={(member) => (selectedMember = member)}
					placeholder={m['attendeesAdmin.createModalMemberPlaceholder']()}
				/>
			</div>

			<!-- Status selection -->
			<div class="space-y-2">
				<span id="create-rsvp-status-label" class="text-sm font-medium"
					>{m['attendeesAdmin.editModalNewStatus']()}</span
				>
				<div class="space-y-2" role="radiogroup" aria-labelledby="create-rsvp-status-label">
					<label
						class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
					>
						<input
							type="radio"
							name="create-status"
							value="yes"
							bind:group={selectedStatus}
							class="h-4 w-4 text-green-600 focus:ring-green-600"
						/>
						<span class="text-sm font-medium">{m['attendeesAdmin.editModalYesLabel']()}</span>
					</label>
					<label
						class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
					>
						<input
							type="radio"
							name="create-status"
							value="maybe"
							bind:group={selectedStatus}
							class="h-4 w-4 text-yellow-600 focus:ring-yellow-600"
						/>
						<span class="text-sm font-medium">{m['attendeesAdmin.editModalMaybeLabel']()}</span>
					</label>
					<label
						class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
					>
						<input
							type="radio"
							name="create-status"
							value="no"
							bind:group={selectedStatus}
							class="h-4 w-4 text-red-600 focus:ring-red-600"
						/>
						<span class="text-sm font-medium">{m['attendeesAdmin.editModalNoLabel']()}</span>
					</label>
				</div>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={onCancel}>{m['attendeesAdmin.editModalCancel']()}</Button>
			<Button onclick={handleSubmit} disabled={isPending || !selectedUserId}>
				{isPending
					? m['attendeesAdmin.createModalSubmitting']()
					: m['attendeesAdmin.createModalSubmit']()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
