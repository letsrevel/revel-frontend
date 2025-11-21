<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventTokenSchema,
		EventTokenCreateSchema,
		EventTokenUpdateSchema
	} from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { AlertCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-svelte';
	import { durationOptions } from '$lib/utils/tokens';
	import { toDateTimeLocal, toISOString } from '$lib/utils/datetime';

	interface Props {
		open: boolean;
		token?: EventTokenSchema | null;
		ticketTiers?: Array<{ id: string; name: string }>;
		isTicketedEvent?: boolean;
		isLoading?: boolean;
		onClose: () => void;
		onSave: (data: EventTokenCreateSchema | EventTokenUpdateSchema) => void | Promise<void>;
	}

	let {
		open,
		token = null,
		ticketTiers = [],
		isTicketedEvent = false,
		isLoading = false,
		onClose,
		onSave
	}: Props = $props();

	const isEdit = $derived(!!token);

	// Form state
	let name = $state('');
	let duration = $state<string>('1440');
	let maxUses = $state<number>(1);
	let grantsInvitation = $state(true); // Default to granting invitation
	let ticketTierId = $state<string | null>(null);
	let expiresAt = $state<string>('');

	// Advanced invitation options
	let showAdvanced = $state(false);
	let waivesQuestionnaire = $state(false);
	let waivesPurchase = $state(false);
	let overridesMaxAttendees = $state(false);
	let waivesMembershipRequired = $state(false);
	let waivesRsvpDeadline = $state(false);

	// Reset form
	$effect(() => {
		if (open) {
			if (token) {
				name = token.name || '';
				maxUses = token.max_uses ?? 1;
				grantsInvitation = token.grants_invitation ?? true;
				ticketTierId = token.ticket_tier || null;
				expiresAt = toDateTimeLocal(token.expires_at);
				duration = '1440';

				// Load advanced invitation options
				const invitation = token.invitation_payload as any;
				waivesQuestionnaire = invitation?.waives_questionnaire ?? false;
				waivesPurchase = invitation?.waives_purchase ?? false;
				overridesMaxAttendees = invitation?.overrides_max_attendees ?? false;
				waivesMembershipRequired = invitation?.waives_membership_required ?? false;
				waivesRsvpDeadline = invitation?.waives_rsvp_deadline ?? false;
			} else {
				name = '';
				duration = '1440';
				maxUses = 1;
				grantsInvitation = true;
				ticketTierId = null;
				expiresAt = '';

				// Reset advanced options
				showAdvanced = false;
				waivesQuestionnaire = false;
				waivesPurchase = false;
				overridesMaxAttendees = false;
				waivesMembershipRequired = false;
				waivesRsvpDeadline = false;
			}
		}
	});

	function handleSave() {
		// Build invitation_payload object with all options if granting invitation
		// If grantsInvitation is false, invitation_payload will be null (no invitation granted)
		const invitation_payload = grantsInvitation
			? {
					waives_questionnaire: waivesQuestionnaire,
					waives_purchase: waivesPurchase,
					overrides_max_attendees: overridesMaxAttendees,
					waives_membership_required: waivesMembershipRequired,
					waives_rsvp_deadline: waivesRsvpDeadline
				}
			: null;

		if (isEdit && token) {
			const updateData: EventTokenUpdateSchema = {
				name: name || null,
				max_uses: grantsInvitation ? maxUses : 0,
				expires_at: toISOString(expiresAt),
				grants_invitation: grantsInvitation,
				ticket_tier_id: ticketTierId || null,
				invitation_payload
			};
			onSave(updateData);
		} else {
			const createData: EventTokenCreateSchema = {
				name: name || null,
				duration: parseInt(duration, 10),
				max_uses: grantsInvitation ? maxUses : 0,
				grants_invitation: grantsInvitation,
				ticket_tier_id: ticketTierId || null,
				invitation_payload
			};
			onSave(createData);
		}
	}

	const showTicketTierRequired = $derived(grantsInvitation && isTicketedEvent && !ticketTierId);
</script>

<Dialog
	{open}
	onOpenChange={(isOpen) => {
		if (!isOpen) onClose();
	}}
>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
		<DialogHeader>
			<DialogTitle>{isEdit ? 'Edit' : 'Create'} Invitation Link</DialogTitle>
			<DialogDescription>
				{#if isEdit}
					Update link settings. The shareable URL will remain the same.
				{:else}
					Create a shareable invitation link for this event.
				{/if}
			</DialogDescription>
		</DialogHeader>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSave();
			}}
			class="space-y-4"
		>
			<!-- Name -->
			<div class="space-y-2">
				<Label for="link-name">{m['eventTokenModal.nameOptional']()}</Label>
				<Input
					id="link-name"
					bind:value={name}
					placeholder="e.g., Instagram Followers, VIP Access"
					maxlength={150}
				/>
			</div>

			{#if !isEdit}
				<!-- Duration -->
				<div class="space-y-2">
					<Label>{m['eventTokenModal.duration']()}</Label>
					<RadioGroup bind:value={duration}>
						{#each durationOptions as option}
							<div class="flex items-center space-x-2">
								<RadioGroupItem value={String(option.value)} id={`duration-${option.value}`} />
								<Label for={`duration-${option.value}`} class="font-normal">
									{option.label}
								</Label>
							</div>
						{/each}
					</RadioGroup>
				</div>
			{:else}
				<!-- Expires At -->
				<div class="space-y-2">
					<Label for="expires-at">{m['eventTokenModal.expirationDate']()}</Label>
					<Input id="expires-at" type="datetime-local" bind:value={expiresAt} />
				</div>
			{/if}

			<!-- Grant Invitation -->
			<div class="flex items-center space-x-2">
				<input
					type="checkbox"
					id="grants-invitation"
					bind:checked={grantsInvitation}
					class="h-4 w-4 rounded border-gray-300"
				/>
				<Label for="grants-invitation" class="font-normal">
					{#if isTicketedEvent}
						Grant invitation (allows users to buy tickets)
					{:else}
						Grant invitation (allows users to RSVP)
					{/if}
				</Label>
			</div>

			<!-- Max Uses (only if granting invitation) -->
			{#if grantsInvitation}
				<!-- Max Uses -->
				<div class="space-y-2">
					<Label for="max-uses">{m['eventTokenModal.maxUses']()}</Label>
					<Input
						id="max-uses"
						type="number"
						bind:value={maxUses}
						min={0}
						placeholder="0 = unlimited"
					/>
					<p class="text-xs text-muted-foreground">
						Set to 0 for unlimited uses, or specify a number to limit how many people can use this
						link.
					</p>
					{#if isEdit && token && token.uses !== undefined && maxUses < token.uses}
						<p class="flex items-center gap-1 text-xs text-destructive">
							<AlertCircle class="h-3 w-3" aria-hidden="true" />
							Warning: This will disable the link (already {token.uses} uses)
						</p>
					{/if}
				</div>

				<!-- Ticket Tier (only if granting invitation) -->
				{#if ticketTiers.length > 0}
					<div class="space-y-2">
						<Label for="ticket-tier">
							Ticket Tier {isTicketedEvent ? '(required)' : '(optional)'}
						</Label>
						<select
							id="ticket-tier"
							bind:value={ticketTierId}
							class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							<option value={null}>{m['eventTokenModal.noTicketTier']()}</option>
							{#each ticketTiers as tier}
								<option value={tier.id}>{tier.name}</option>
							{/each}
						</select>
						{#if showTicketTierRequired}
							<p class="flex items-center gap-1 text-xs text-destructive">
								<AlertCircle class="h-3 w-3" aria-hidden="true" />
								Ticket tier is required for ticketed events
							</p>
						{/if}
					</div>
				{/if}

				<!-- Advanced Invitation Options -->
				<div class="space-y-3 rounded-lg border border-border p-4">
					<button
						type="button"
						onclick={() => (showAdvanced = !showAdvanced)}
						class="flex w-full items-center justify-between text-sm font-medium transition-colors hover:text-foreground"
					>
						<span>{m['eventTokenModal.advancedOptions']()}</span>
						{#if showAdvanced}
							<ChevronDown class="h-4 w-4" aria-hidden="true" />
						{:else}
							<ChevronRight class="h-4 w-4" aria-hidden="true" />
						{/if}
					</button>

					{#if showAdvanced}
						<div class="space-y-3 border-t pt-3">
							<p class="text-xs text-muted-foreground">
								Configure special permissions and exceptions for users who use this invitation link.
							</p>

							<!-- Waives Questionnaire -->
							<div class="flex items-start space-x-2">
								<input
									type="checkbox"
									id="waives-questionnaire"
									bind:checked={waivesQuestionnaire}
									class="mt-0.5 h-4 w-4 rounded border-gray-300"
								/>
								<div class="flex-1">
									<Label for="waives-questionnaire" class="font-normal">
										Waive questionnaire requirement
									</Label>
									<p class="text-xs text-muted-foreground">
										Users can RSVP without completing required questionnaires
									</p>
								</div>
							</div>

							<!-- Waives Purchase -->
							<div class="flex items-start space-x-2">
								<input
									type="checkbox"
									id="waives-purchase"
									bind:checked={waivesPurchase}
									class="mt-0.5 h-4 w-4 rounded border-gray-300"
								/>
								<div class="flex-1">
									<Label for="waives-purchase" class="font-normal">
										Waive ticket purchase requirement
									</Label>
									<p class="text-xs text-muted-foreground">
										Users get free access even if the ticket tier has a price
									</p>
								</div>
							</div>

							<!-- Overrides Max Attendees -->
							<div class="flex items-start space-x-2">
								<input
									type="checkbox"
									id="overrides-max-attendees"
									bind:checked={overridesMaxAttendees}
									class="mt-0.5 h-4 w-4 rounded border-gray-300"
								/>
								<div class="flex-1">
									<Label for="overrides-max-attendees" class="font-normal">
										Override attendee limit
									</Label>
									<p class="text-xs text-muted-foreground">
										Allow RSVPs even if the event or tier has reached maximum capacity
									</p>
								</div>
							</div>

							<!-- Waives Membership Required -->
							<div class="flex items-start space-x-2">
								<input
									type="checkbox"
									id="waives-membership"
									bind:checked={waivesMembershipRequired}
									class="mt-0.5 h-4 w-4 rounded border-gray-300"
								/>
								<div class="flex-1">
									<Label for="waives-membership" class="font-normal">
										Waive membership requirement
									</Label>
									<p class="text-xs text-muted-foreground">
										Users can RSVP without being a member of the organization
									</p>
								</div>
							</div>

							<!-- Waives RSVP Deadline -->
							<div class="flex items-start space-x-2">
								<input
									type="checkbox"
									id="waives-deadline"
									bind:checked={waivesRsvpDeadline}
									class="mt-0.5 h-4 w-4 rounded border-gray-300"
								/>
								<div class="flex-1">
									<Label for="waives-deadline" class="font-normal"
										>{m['eventTokenModal.waiveDeadline']()}</Label
									>
									<p class="text-xs text-muted-foreground">
										Users can RSVP even after the RSVP deadline has passed
									</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<DialogFooter>
				<Button type="button" variant="outline" onclick={onClose} disabled={isLoading}>
					Cancel
				</Button>
				<Button type="submit" disabled={isLoading || showTicketTierRequired}>
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{isEdit ? 'Save Changes' : 'Create Link'}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
