<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import MemberCombobox from '$lib/components/members/MemberCombobox.svelte';
	import { eventadminrsvpsListRsvps } from '$lib/api';
	import type {
		OrganizationAdminDetailSchema,
		OrganizationMemberSchema
	} from '$lib/api/generated/types.gen';

	interface Props {
		open: boolean;
		organization: OrganizationAdminDetailSchema;
		eventId: string;
		accessToken: string | null;
		isPending: boolean;
		onSubmit: (userId: string, status: 'yes' | 'maybe' | 'no', note: string) => void;
		onCancel: () => void;
	}

	let {
		open = $bindable(),
		organization,
		eventId,
		accessToken,
		isPending,
		onSubmit,
		onCancel
	}: Props = $props();

	let selectedMember = $state<OrganizationMemberSchema | null>(null);
	let selectedStatus = $state<'yes' | 'maybe' | 'no'>('yes');
	let note = $state('');

	// Reset the form whenever the dialog is (re)opened
	$effect(() => {
		if (open) {
			selectedMember = null;
			selectedStatus = 'yes';
			note = '';
		}
	});

	const selectedUserId = $derived(selectedMember?.user.id ?? null);

	/**
	 * Select a member and best-effort prefill the NOTE from their existing
	 * RSVP. The admin create endpoint is a wholesale upsert (an omitted note
	 * clears a stored one), so re-creating an RSVP must carry the current note
	 * along. The status radio is a deliberate choice — never prefill it, and
	 * never overwrite a note the admin has already started typing.
	 */
	async function handleMemberSelect(member: OrganizationMemberSchema | null) {
		selectedMember = member;
		note = '';
		const email = member?.user.email;
		if (!member || !email) return;
		try {
			const response = await eventadminrsvpsListRsvps({
				path: { event_id: eventId },
				query: { search: email, include_past: true },
				headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
			});
			const existing = response.data?.results?.find((r) => r.user.id === member.user.id);
			// Guard against a stale response (admin picked someone else meanwhile)
			// and against clobbering a note typed while the lookup was in flight.
			if (existing?.note && selectedMember?.user.id === member.user.id && note === '') {
				note = existing.note;
			}
		} catch {
			// Prefill is best-effort — creating without it still works.
		}
	}

	function handleSubmit() {
		if (!selectedUserId) return;
		onSubmit(selectedUserId, selectedStatus, note);
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
					onSelect={handleMemberSelect}
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

			<!-- Note (allowed regardless of the event setting — phone/offline RSVPs) -->
			<div class="space-y-2">
				<Label for="create-rsvp-note">{m['attendeesAdmin.noteFieldLabel']()}</Label>
				<Textarea
					id="create-rsvp-note"
					bind:value={note}
					maxlength={500}
					rows={3}
					disabled={isPending}
					aria-describedby="create-rsvp-note-counter"
				/>
				<p
					id="create-rsvp-note-counter"
					class="text-right text-xs text-muted-foreground"
					aria-live="polite"
				>
					{m['rsvpNoteDialog.counter']({ count: note.length, max: 500 })}
				</p>
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
