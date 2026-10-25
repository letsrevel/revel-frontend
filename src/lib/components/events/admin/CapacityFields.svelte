<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventCreateSchema, VenueDetailSchema } from '$lib/api/generated/types.gen';
	import { Info, ExternalLink } from '@lucide/svelte';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import WaitlistAdvancedSection from './WaitlistAdvancedSection.svelte';

	interface Props {
		formData: Partial<EventCreateSchema> & {
			id?: string;
			seats_held?: number;
			waitlist_time_window?: string | null;
			waitlist_batch_size?: number | null;
			waitlist_cutoff_date?: string | null;
			waitlist_lottery_mode?: boolean | null;
		};
		selectedVenue?: VenueDetailSchema | null;
		isEditMode?: boolean;
		onUpdate: (data: Partial<EventCreateSchema>) => void;
	}

	const { formData, selectedVenue = null, isEditMode = false, onUpdate }: Props = $props();

	let waitlistInfoOpen = $state(false);
	let closeWaitlistConfirmOpen = $state(false);

	// If the user closes the waitlist while pending offers are held, defer the
	// change behind a confirm dialog (otherwise revoking those offers is silent).
	function handleWaitlistOpenChange(e: Event & { currentTarget: HTMLInputElement }): void {
		const nextValue = e.currentTarget.checked;
		const wasOpen = formData.waitlist_open === true;
		const seatsHeld = formData.seats_held ?? 0;
		if (wasOpen && !nextValue && seatsHeld > 0) {
			e.currentTarget.checked = true;
			closeWaitlistConfirmOpen = true;
			return;
		}
		onUpdate({ waitlist_open: nextValue });
	}

	function confirmCloseWaitlist(): void {
		closeWaitlistConfirmOpen = false;
		onUpdate({ waitlist_open: false });
	}

	function cancelCloseWaitlist(): void {
		closeWaitlistConfirmOpen = false;
	}
</script>

<!-- Capacity, waitlist and invitation message. Shared by the wizard's DetailsStep
     accordion and the event editor's Attendance section. -->
<div class="space-y-4">
	<!-- Max Attendees -->
	<div class="space-y-2">
		<label for="max-attendees" class="block text-sm font-medium">
			{m['detailsStep.maxAttendees']()}
		</label>
		<input
			id="max-attendees"
			type="number"
			min="1"
			value={formData.max_attendees || ''}
			oninput={(e) => onUpdate({ max_attendees: parseInt(e.currentTarget.value) || undefined })}
			placeholder={m['detailsStep.unlimited']()}
			class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		/>
		<p class="text-xs text-muted-foreground">{m['detailsStep.unlimitedCapacity']()}</p>

		<!-- Effective Capacity Display -->
		{#if selectedVenue?.capacity}
			{@const venueCapacity = selectedVenue.capacity}
			{@const maxAttendees = formData.max_attendees}
			{@const effectiveCapacity = maxAttendees
				? Math.min(maxAttendees, venueCapacity)
				: venueCapacity}
			<div class="mt-3 rounded-md bg-muted p-3 text-sm">
				<div class="font-medium">
					{m['eventWizard.effectiveCapacity.label']()}: {effectiveCapacity}
				</div>
				{#if maxAttendees && maxAttendees > venueCapacity}
					<p class="mt-1.5 text-highlight-foreground dark:text-highlight">
						⚠️ {m['eventWizard.effectiveCapacity.warning']({
							maxAttendees: maxAttendees.toString(),
							venueCapacity: venueCapacity.toString(),
							effectiveCapacity: effectiveCapacity.toString()
						})}
					</p>
				{:else if !maxAttendees}
					<p class="mt-1 text-muted-foreground">
						{m['eventWizard.effectiveCapacity.limitedByVenue']({
							capacity: venueCapacity.toString()
						})}
					</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Waitlist Open -->
	<div class="space-y-2">
		<label
			class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
		>
			<input
				type="checkbox"
				checked={formData.waitlist_open || false}
				onchange={handleWaitlistOpenChange}
				class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
			/>
			<div class="flex-1">
				<div class="font-medium">{m['detailsStep.waitlistOpen']()}</div>
				<div class="text-sm text-muted-foreground">
					{m['detailsStep.waitlistHint']()}
				</div>
				<button
					type="button"
					onclick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						waitlistInfoOpen = true;
					}}
					class="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
				>
					<Info class="h-3.5 w-3.5" aria-hidden="true" />
					{m['detailsStep.waitlistInfoButton']()}
				</button>
			</div>
		</label>

		<WaitlistAdvancedSection
			{formData}
			{isEditMode}
			confirmCloseOpen={closeWaitlistConfirmOpen}
			onConfirmClose={confirmCloseWaitlist}
			onCancelClose={cancelCloseWaitlist}
			{onUpdate}
		/>
	</div>

	<!-- Invitation Message -->
	<div class="space-y-2">
		<label for="invitation-message" class="block text-sm font-medium">
			{m['detailsStep.invitationMessage']()}
		</label>
		<textarea
			id="invitation-message"
			value={formData.invitation_message || ''}
			oninput={(e) => onUpdate({ invitation_message: e.currentTarget.value })}
			placeholder={m['detailsStep.invitationMessagePlaceholder']()}
			rows={4}
			class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		></textarea>
		<p class="text-xs text-muted-foreground">
			{m['detailsStep.invitationMessageHint']()}
		</p>
	</div>
</div>

<!-- Waitlist Info Dialog -->
<Dialog bind:open={waitlistInfoOpen}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['detailsStep.waitlistInfoTitle']()}</DialogTitle>
		</DialogHeader>
		<div class="space-y-3 text-sm text-muted-foreground">
			<p>{m['detailsStep.waitlistInfoBody1']()}</p>
			<p>{m['detailsStep.waitlistInfoBody2']()}</p>
			<p>{m['detailsStep.waitlistInfoBody3']()}</p>
			<a
				href="https://github.com/letsrevel/revel-backend/issues/2"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-1 text-primary hover:underline"
			>
				{m['detailsStep.waitlistInfoFeedbackCta']()}
				<ExternalLink class="h-3.5 w-3.5" aria-hidden="true" />
				<span class="sr-only">({m['common.opensInNewTab']()})</span>
			</a>
		</div>
	</DialogContent>
</Dialog>
