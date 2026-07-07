<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventTokenSchema,
		EventTokenCreateSchema,
		EventTokenUpdateSchema,
		TicketTierDetailSchema
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
	import DateTimePicker from '$lib/components/forms/DateTimePicker.svelte';
	import { AlertCircle, Loader2, ChevronDown, ChevronRight } from '@lucide/svelte';

	interface Props {
		open: boolean;
		token?: EventTokenSchema | null;
		isLoading?: boolean;
		ticketTiers?: TicketTierDetailSchema[];
		/** Event start (ISO) used to prefill the expiration date on create. */
		eventStart?: string | null;
		onClose: () => void;
		onSave: (data: EventTokenCreateSchema | EventTokenUpdateSchema) => void | Promise<void>;
	}

	const {
		open,
		token = null,
		isLoading = false,
		ticketTiers = [],
		eventStart = null,
		onClose,
		onSave
	}: Props = $props();

	const isEdit = $derived(!!token);

	// Form state — `expiresAt` holds an ISO 8601 string (DateTimePicker's value format);
	// an empty string means "never expires".
	let name = $state('');
	let maxUses = $state<number>(1);
	let grantsInvitation = $state(true); // Default to granting invitation
	let expiresAt = $state<string>('');

	/** Default the create form's expiration to the event start, but only if it's in the future. */
	function defaultCreateExpiry(): string {
		if (eventStart && new Date(eventStart).getTime() > Date.now()) {
			return eventStart;
		}
		return '';
	}

	/**
	 * Convert the chosen expiration (ISO) into the `duration` (minutes from now) the create
	 * endpoint expects. Only an empty (or unparseable) value maps to 0 = "never expires"; a
	 * non-empty date never silently collapses to "never" — a past/elapsed value yields the
	 * 1-minute minimum so the link expires promptly rather than living forever.
	 */
	function expiryToDurationMinutes(iso: string): number {
		if (!iso) return 0;
		const ms = new Date(iso).getTime();
		if (Number.isNaN(ms)) return 0; // unparseable → treat as "never" (defensive)
		return Math.max(1, Math.round((ms - Date.now()) / 60000));
	}

	// Advanced invitation options
	let showAdvanced = $state(false);
	let waivesQuestionnaire = $state(false);
	let waivesPurchase = $state(false);
	let overridesMaxAttendees = $state(false);
	let waivesMembershipRequired = $state(false);
	let waivesRsvpDeadline = $state(false);
	let waivesApplyDeadline = $state(false);
	let selectedTierIds = $state<string[]>([]);

	// Reset form
	$effect(() => {
		if (open) {
			if (token) {
				name = token.name || '';
				maxUses = token.max_uses ?? 1;
				grantsInvitation = token.grants_invitation ?? true;
				expiresAt = token.expires_at ?? '';

				// Load advanced invitation options
				const invitation = token.invitation_payload;
				waivesQuestionnaire = invitation?.waives_questionnaire === true;
				waivesPurchase = invitation?.waives_purchase === true;
				overridesMaxAttendees = invitation?.overrides_max_attendees === true;
				waivesMembershipRequired = invitation?.waives_membership_required === true;
				waivesRsvpDeadline = invitation?.waives_rsvp_deadline === true;
				waivesApplyDeadline = invitation?.waives_apply_deadline === true;
				selectedTierIds = token.ticket_tiers?.map((t) => t.id) ?? [];
			} else {
				name = '';
				maxUses = 1;
				grantsInvitation = true;
				expiresAt = defaultCreateExpiry();

				// Reset advanced options
				showAdvanced = false;
				waivesQuestionnaire = false;
				waivesPurchase = false;
				overridesMaxAttendees = false;
				waivesMembershipRequired = false;
				waivesRsvpDeadline = false;
				waivesApplyDeadline = false;
				selectedTierIds = [];
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
					waives_rsvp_deadline: waivesRsvpDeadline,
					waives_apply_deadline: waivesApplyDeadline
				}
			: null;

		if (isEdit && token) {
			const updateData: EventTokenUpdateSchema = {
				name: name || null,
				max_uses: grantsInvitation ? maxUses : 0,
				expires_at: expiresAt || null,
				grants_invitation: grantsInvitation,
				invitation_payload,
				ticket_tier_ids: selectedTierIds
			};
			onSave(updateData);
		} else {
			const createData: EventTokenCreateSchema = {
				name: name || null,
				duration: expiryToDurationMinutes(expiresAt),
				max_uses: grantsInvitation ? maxUses : 0,
				grants_invitation: grantsInvitation,
				invitation_payload,
				ticket_tier_ids: selectedTierIds
			};
			onSave(createData);
		}
	}
</script>

<Dialog
	{open}
	onOpenChange={(isOpen) => {
		if (!isOpen) onClose();
	}}
>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
		<DialogHeader>
			<DialogTitle
				>{isEdit
					? m['eventTokenModal.titleEdit']()
					: m['eventTokenModal.titleCreate']()}</DialogTitle
			>
			<DialogDescription>
				{#if isEdit}
					{m['eventTokenModal.descEdit']()}
				{:else}
					{m['eventTokenModal.descCreate']()}
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
					placeholder={m['eventTokenModal.namePlaceholder']()}
					maxlength={150}
				/>
			</div>

			<!-- Expiration date (empty = never expires) -->
			<div class="space-y-2">
				<DateTimePicker
					id="expires-at"
					bind:value={expiresAt}
					label={m['eventTokenModal.expirationDate']()}
				/>
				<p class="text-sm text-muted-foreground">{m['eventTokenModal.expirationHint']()}</p>
			</div>

			<!-- Grant Invitation -->
			<div class="flex items-center space-x-2">
				<input
					type="checkbox"
					id="grants-invitation"
					bind:checked={grantsInvitation}
					class="h-4 w-4 rounded border-gray-300"
				/>
				<Label for="grants-invitation" class="font-normal">
					{m['eventTokenModal.grantInvitation']()}
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
						placeholder={m['eventTokenModal.maxUsesPlaceholder']()}
					/>
					<p class="text-xs text-muted-foreground">
						{m['eventTokenModal.maxUsesHint']()}
					</p>
					{#if isEdit && token && token.uses !== undefined && maxUses < token.uses}
						<p class="flex items-center gap-1 text-xs text-destructive">
							<AlertCircle class="h-3 w-3" aria-hidden="true" />
							{m['eventTokenModal.disableWarning']({ uses: token.uses })}
						</p>
					{/if}
				</div>

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
								{m['eventTokenModal.advancedDescription']()}
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
										{m['eventTokenModal.waiveQuestionnaire']()}
									</Label>
									<p class="text-xs text-muted-foreground">
										{m['eventTokenModal.waiveQuestionnaireHint']()}
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
										{m['eventTokenModal.waivePurchase']()}
									</Label>
									<p class="text-xs text-muted-foreground">
										{m['eventTokenModal.waivePurchaseHint']()}
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
										{m['eventTokenModal.overrideAttendeeLimit']()}
									</Label>
									<p class="text-xs text-muted-foreground">
										{m['eventTokenModal.overrideAttendeeLimitHint']()}
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
										{m['eventTokenModal.waiveMembership']()}
									</Label>
									<p class="text-xs text-muted-foreground">
										{m['eventTokenModal.waiveMembershipHint']()}
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
										{m['eventTokenModal.waiveDeadlineHint']()}
									</p>
								</div>
							</div>

							<!-- Waives Apply Deadline -->
							<div class="flex items-start space-x-2">
								<input
									type="checkbox"
									id="waives-apply-deadline"
									bind:checked={waivesApplyDeadline}
									class="mt-0.5 h-4 w-4 rounded border-gray-300"
								/>
								<div class="flex-1">
									<Label for="waives-apply-deadline" class="font-normal"
										>{m['eventTokenModal.waiveApplyDeadline']()}</Label
									>
									<p class="text-xs text-muted-foreground">
										{m['eventTokenModal.waiveApplyDeadlineHint']()}
									</p>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Ticket tier selection -->
				{#if ticketTiers.length > 0}
					<div class="space-y-3 rounded-lg border border-border p-4">
						<h4 class="text-sm font-semibold">{m['eventTokenModal.assignTiers']()}</h4>
						<p class="text-xs text-muted-foreground">
							{m['eventTokenModal.assignTiersHint']()}
						</p>
						{#each ticketTiers as tier (tier.id ?? tier.name)}
							{#if tier.id}
								<label class="flex cursor-pointer items-start gap-2">
									<input
										type="checkbox"
										checked={selectedTierIds.includes(tier.id)}
										onchange={(e) => {
											const checked = e.currentTarget.checked;
											if (checked && tier.id && !selectedTierIds.includes(tier.id)) {
												selectedTierIds = [...selectedTierIds, tier.id];
											} else if (!checked && tier.id) {
												selectedTierIds = selectedTierIds.filter((id) => id !== tier.id);
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
			{/if}

			<DialogFooter>
				<Button type="button" variant="outline" onclick={onClose} disabled={isLoading}>
					{m['eventTokenModal.cancel']()}
				</Button>
				<Button type="submit" disabled={isLoading}>
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{isEdit ? m['eventTokenModal.saveChanges']() : m['eventTokenModal.createLink']()}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
