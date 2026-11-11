<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type {
		OrganizationMemberSchema,
		MembershipStatus,
		MembershipTierSchema
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import { Loader2, UserCog, UserX, AlertTriangle, Ban, CreditCard } from '@lucide/svelte';
	import { formatPlanPrice } from '$lib/utils/subscriptions';
	import { formatDate } from '$lib/utils/date';

	interface Props {
		member: OrganizationMemberSchema | null;
		tiers: MembershipTierSchema[];
		isStaff: boolean;
		open: boolean;
		onClose: () => void;
		onUpdateStatus: (status: MembershipStatus) => void;
		onUpdateTier: (tierId: string | null) => void;
		onMakeStaff: () => void;
		onRemove: () => void;
		onBlacklist?: (reason: string) => void;
		/**
		 * Close this dialog (through its unsaved-changes guard) and open the member's
		 * subscription. Absent when the viewer cannot manage subscriptions.
		 */
		onManageSubscription?: () => void;
		/** The backend's refusal of a tier change (409 `tier_follows_subscription`). */
		tierLockDetail?: string | null;
		isUpdating?: boolean;
		isPromoting?: boolean;
		isRemoving?: boolean;
		isBlacklisting?: boolean;
	}

	const {
		member,
		tiers,
		isStaff,
		open,
		onClose,
		onUpdateStatus,
		onUpdateTier,
		onMakeStaff,
		onRemove,
		onBlacklist,
		onManageSubscription,
		tierLockDetail = null,
		isUpdating = false,
		isPromoting = false,
		isRemoving = false,
		isBlacklisting = false
	}: Props = $props();

	// Local state for form
	let selectedStatus = $state<MembershipStatus>('active');
	let selectedTierId = $state<string | null>(null);
	let showRemoveConfirm = $state(false);
	let showBlacklistConfirm = $state(false);
	let showBanConfirm = $state(false);
	let blacklistReason = $state('');

	let showDiscardConfirm = $state(false);
	// Set while the discard prompt was raised by "Manage subscription": a confirmed
	// discard then carries on to the subscription instead of just closing.
	let discardThenSubscription = $state(false);

	// Re-initialise the form only when an editing session begins (closed -> open, or a
	// different member). A refreshed object for the SAME member (window-focus refetch,
	// a parallel mutation) must not wipe staged edits or close an open discard prompt.
	let sessionKey: string | null = null;
	$effect(() => {
		const key = open && member ? (member.user.id ?? member.user.email ?? '') : null;
		if (key === null) {
			sessionKey = null;
			return;
		}
		if (key === sessionKey) return;
		sessionKey = key;
		untrack(() => {
			if (!member) return;
			selectedStatus = member.status;
			selectedTierId = member.tier?.id || null;
			showRemoveConfirm = false;
			showBlacklistConfirm = false;
			showBanConfirm = false;
			showDiscardConfirm = false;
			blacklistReason = '';
		});
	});

	// Display name
	const displayName = $derived(
		member
			? member.user.preferred_name ||
					(member.user.first_name && member.user.last_name
						? `${member.user.first_name} ${member.user.last_name}`
						: member.user.first_name || member.user.email || m['manageMemberModal.unknownUser']())
			: ''
	);

	// "Tier follows the plan": a live subscription owns the tier, so staff change
	// the plan instead. A 409 from a race (the subscription appeared after this
	// dialog loaded) locks it too.
	const tierLocked = $derived(!!member?.tier_locked_by_subscription || !!tierLockDetail);
	// "Manage subscription" is only advertised when there is a subscription to open:
	// in the 409 race the member row may not carry its id yet (it is refetched), and
	// a button that closes this dialog and then does nothing is worse than none.
	const canManageSubscription = $derived(!!onManageSubscription && !!member?.subscription_id);
	const tierLockReason = $derived(
		tierLockDetail ??
			(canManageSubscription
				? m['manageMemberModal.tierLockedReason']()
				: m['manageMemberModal.tierLockedReasonNoAction']())
	);
	// A locked tier is never staged, so it can never count as an unsaved change.
	$effect(() => {
		if (tierLocked && member) selectedTierId = member.tier?.id || null;
	});

	// Check if changes were made
	const hasStatusChanged = $derived(member && selectedStatus !== member.status);
	const hasTierChanged = $derived(
		member && !tierLocked && selectedTierId !== (member.tier?.id || null)
	);
	const hasChanges = $derived(hasStatusChanged || hasTierChanged);

	// Statuses
	const statuses: MembershipStatus[] = ['active', 'paused', 'cancelled', 'banned'];

	// Ban / blacklist / remove cancel the member's subscription and stop billing
	// server-side — and since BE `d3773257` (`_mirror_status_to_subscriptions`) so
	// does setting the status to *cancelled*, while *paused* pauses collection. The
	// backend inlines that subscription on the member row, already scoped to this
	// organization and filtered to non-terminal statuses (BE `e37fe2a5`), so a
	// non-null value means "there is live billing to lose" — and a null one means the
	// member pays nothing, so no billing sentence is shown at all.
	const subscription = $derived(member?.subscription ?? null);

	// The period end is only meaningful while the subscription is still being billed
	// on a schedule; on a paused or never-paid (pending) row the stored value is
	// stale or absent, so it would mislead rather than inform.
	const billingPeriodEnd = $derived(
		subscription && (subscription.status === 'active' || subscription.status === 'past_due')
			? (subscription.current_period_end ?? null)
			: null
	);

	// Banning also cancels the member's subscription and stops billing on the
	// backend, so the transition *to* banned needs an explicit confirmation.
	// Tier edits and the other statuses stay one-click.
	const isBanTransition = $derived(
		!!member && selectedStatus === 'banned' && member.status !== 'banned'
	);

	// The billing side-effects below belong to the *transition*, not to the status
	// the member already sits in: re-opening the modal on an already-paused member
	// must not warn about a pause that happened long ago.
	const isRestoreTransition = $derived(
		!!member && selectedStatus === 'active' && member.status !== 'active'
	);
	const isPauseTransition = $derived(
		!!member && selectedStatus === 'paused' && member.status !== 'paused'
	);
	// Cancelling is the same money-moving act as a ban (BE treats CANCELLED as
	// "not a member" and terminalizes the subscription), so it gets the same
	// disclosure — the shared snippet, not a second sentence saying the same thing.
	const isCancelTransition = $derived(
		!!member && selectedStatus === 'cancelled' && member.status !== 'cancelled'
	);

	function handleSaveChanges() {
		if (!member) return;

		if (isBanTransition && !showBanConfirm) {
			showBanConfirm = true;
			return;
		}

		commitChanges();
	}

	function commitChanges() {
		showBanConfirm = false;

		if (hasStatusChanged) {
			onUpdateStatus(selectedStatus);
		}

		if (hasTierChanged) {
			onUpdateTier(selectedTierId);
		}
	}

	function handleCancelBan() {
		showBanConfirm = false;
	}

	// The confirm panel replaces the "Save Changes" button, so the element that
	// was focused disappears. Move focus onto the confirm button, otherwise a
	// keyboard user is dropped back to the top of the dialog.
	let banConfirmButton = $state<HTMLElement | null>(null);
	$effect(() => {
		if (showBanConfirm) {
			banConfirmButton?.focus();
		}
	});

	function handleRemoveClick() {
		showRemoveConfirm = true;
	}

	function handleConfirmRemove() {
		onRemove();
		showRemoveConfirm = false;
	}

	function handleCancelRemove() {
		showRemoveConfirm = false;
	}

	function handleMakeStaffClick() {
		onMakeStaff();
	}

	function handleBlacklistClick() {
		showBlacklistConfirm = true;
	}

	function handleConfirmBlacklist() {
		if (onBlacklist) {
			onBlacklist(blacklistReason);
		}
	}

	function handleCancelBlacklist() {
		showBlacklistConfirm = false;
		blacklistReason = '';
	}

	// Disabled state for actions
	const isProcessing = $derived(isUpdating || isPromoting || isRemoving || isBlacklisting);

	// Handle dialog open/close changes
	// Close / Escape / overlay click / the corner X with unsaved tier or status edits
	// asks first (in-app confirm, never window.confirm); a clean dialog closes at once.
	// Every route funnels into requestClose through the Dialog's function binding below,
	// which never writes the new value back, so a guarded close keeps the dialog open.
	function requestClose(): void {
		if (hasChanges && !isProcessing) {
			showDiscardConfirm = true;
			return;
		}
		onClose();
	}

	function handleDiscard(): void {
		showDiscardConfirm = false;
		if (member) {
			selectedStatus = member.status;
			selectedTierId = member.tier?.id || null;
		}
		onClose();
		if (discardThenSubscription) onManageSubscription?.();
		discardThenSubscription = false;
	}

	// Same guard as every other way out of the dialog, then on to the subscription.
	function goToSubscription(): void {
		if (hasChanges && !isProcessing) {
			discardThenSubscription = true;
			showDiscardConfirm = true;
			return;
		}
		onClose();
		onManageSubscription?.();
	}
</script>

<!--
	The billing consequence of losing membership, stated only when there is billing
	to lose. Rendered as plain sentences (never colour alone) so the warning survives
	a screen reader or a monochrome display.
-->
{#snippet billingNotice(textClass: string)}
	{#if subscription}
		<p class={textClass}>
			{m['membershipLoss.subscriptionCancelledPlan']({
				plan: subscription.plan.name,
				price: formatPlanPrice(subscription.plan)
			})}
		</p>
		{#if subscription.status !== 'active'}
			<p class={textClass}>
				{m['membershipLoss.subscriptionStatusNote']({
					status: m[`subscriptions.status.${subscription.status}`]()
				})}
			</p>
		{/if}
		{#if billingPeriodEnd}
			<p class={textClass}>
				{m['membershipLoss.subscriptionPeriodEnds']({ date: formatDate(billingPeriodEnd) })}
			</p>
		{/if}
	{/if}
{/snippet}

<Dialog
	bind:open={
		() => open,
		(next) => {
			if (!next) requestClose();
		}
	}
>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
		{#if member}
			<DialogHeader>
				<DialogTitle>{m['manageMemberModal.title']({ name: displayName })}</DialogTitle>
			</DialogHeader>

			<div class="space-y-6 py-4">
				<!-- Status Section -->
				<div class="space-y-2">
					<Label for="status">{m['manageMemberModal.statusLabel']()}</Label>
					<Select
						type="single"
						value={selectedStatus}
						onValueChange={(value) => {
							selectedStatus = value as MembershipStatus;
							// Re-picking a status invalidates a pending ban confirmation.
							showBanConfirm = false;
						}}
						disabled={isProcessing}
					>
						<SelectTrigger id="status" aria-label={m['manageMemberModal.statusLabel']()}>
							{m[`memberStatus.${selectedStatus}`]()}
						</SelectTrigger>
						<SelectContent>
							{#each statuses as status (status)}
								<SelectItem value={status}>
									{m[`memberStatus.${status}`]()}
								</SelectItem>
							{/each}
						</SelectContent>
					</Select>
					<!-- Status Explanation -->
					<p class="text-sm text-muted-foreground">
						{#if selectedStatus === 'active'}
							{m['manageMemberModal.statusExplanation.active']()}
						{:else if selectedStatus === 'paused'}
							{m['manageMemberModal.statusExplanation.paused']()}
						{:else if selectedStatus === 'cancelled'}
							{m['manageMemberModal.statusExplanation.cancelled']()}
						{:else if selectedStatus === 'banned'}
							{m['manageMemberModal.statusExplanation.banned']()}
						{/if}
					</p>
					<!--
						What the staged transition does to the member's money. Banned is
						absent on purpose: it has its own warning box below, and repeating
						the billing line here would state it twice on one screen.
					-->
					{#if isRestoreTransition}
						<p class="text-sm text-muted-foreground">
							{m['manageMemberModal.statusExplanation.activeBillingNote']()}
						</p>
					{:else if isPauseTransition && subscription}
						<p class="text-sm text-muted-foreground">
							{#if subscription.cancel_at_period_end}
								<!-- The backend skips the pause for a subscription already
								     scheduled to cancel, so this one keeps billing. -->
								{m['manageMemberModal.statusExplanation.pausedScheduledEndNote']()}
							{:else}
								{m['manageMemberModal.statusExplanation.pausedBillingNote']()}
							{/if}
						</p>
					{:else if isCancelTransition}
						{@render billingNotice('text-sm text-muted-foreground')}
					{/if}
					{#if selectedStatus === 'banned'}
						<!-- dark:bg-destructive/25 (AutoEvalRecommendation's pattern): a /10
						     red wash is nearly invisible on the dark surface, so dark
						     strengthens the tint. The icon stays `text-destructive`, which is
						     --destructive-text since #781. This panel is inside DialogContent
						     (bg-background), so the governing figures are 7.20:1 light on /10
						     and 5.84:1 dark on /25; over a bg-card container the same recipe is
						     8.10:1 / 5.37:1. All four are audited rows in
						     scripts/audit-brand-themes.py. The old FILL value measured
						     2.69-2.95:1 here, under the 3:1 non-text floor. -->
						<div
							class="flex gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm dark:bg-destructive/25"
						>
							<AlertTriangle class="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
							<div class="space-y-2 text-foreground">
								<p>{m['manageMemberModal.bannedWarning']()}</p>
								<!-- The confirm panel below restates this line, so show it here only
								     while that panel is closed — never the same sentence twice. -->
								{#if isBanTransition && !showBanConfirm}
									{@render billingNotice('')}
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- Tier Section -->
				<div class="space-y-2">
					<Label for="tier">{m['manageMemberModal.tierLabel']()}</Label>
					<Select
						type="single"
						value={selectedTierId || 'none'}
						onValueChange={(value) => {
							selectedTierId = value === 'none' ? null : value;
						}}
						disabled={isProcessing || tierLocked}
					>
						<SelectTrigger
							id="tier"
							aria-label={m['manageMemberModal.tierLabel']()}
							aria-describedby={tierLocked ? 'member-tier-lock-reason' : undefined}
						>
							{selectedTierId
								? tiers.find((t) => t.id === selectedTierId)?.name ||
									m['manageMemberModal.noTier']()
								: m['manageMemberModal.noTier']()}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">{m['manageMemberModal.noTier']()}</SelectItem>
							{#each tiers as tier (tier.id ?? tier.name)}
								{#if tier.id}
									<SelectItem value={tier.id}>{tier.name}</SelectItem>
								{/if}
							{/each}
						</SelectContent>
					</Select>
					{#if tierLocked}
						<div class="space-y-2" data-testid="member-tier-lock">
							<p id="member-tier-lock-reason" class="text-sm text-muted-foreground">
								{tierLockReason}
							</p>
							{#if canManageSubscription}
								<Button
									variant="outline"
									size="sm"
									onclick={goToSubscription}
									disabled={isProcessing}
									data-testid="member-tier-lock-manage-subscription"
								>
									<CreditCard class="mr-2 h-4 w-4" aria-hidden="true" />
									{m['memberPeople.sheet.manageSubscription']()}
								</Button>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Save Changes Button / Ban Confirmation -->
				{#if hasChanges}
					{#if showBanConfirm && isBanTransition}
						<div class="space-y-2 rounded-lg border border-destructive bg-destructive/10 p-4">
							<div class="flex gap-2">
								<AlertTriangle class="h-5 w-5 shrink-0 text-destructive" />
								<div class="flex-1 space-y-2">
									<p role="heading" aria-level="4" class="text-sm font-medium text-foreground">
										{m['manageMemberModal.banConfirmTitle']({ name: displayName })}
									</p>
									<p class="text-sm text-foreground">
										{m['manageMemberModal.banConfirmMessage']()}
									</p>
									{@render billingNotice('text-sm text-foreground')}
									<div class="flex gap-2">
										<Button
											bind:ref={banConfirmButton}
											variant="destructive"
											size="sm"
											onclick={commitChanges}
											disabled={isProcessing}
										>
											{#if isUpdating}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" />
											{/if}
											{m['manageMemberModal.confirmBan']()}
										</Button>
										<Button
											variant="outline"
											size="sm"
											onclick={handleCancelBan}
											disabled={isProcessing}
										>
											{m['manageMemberModal.cancel']()}
										</Button>
									</div>
								</div>
							</div>
						</div>
					{:else}
						<Button onclick={handleSaveChanges} disabled={isProcessing} class="w-full">
							{#if isUpdating}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{/if}
							{m['manageMemberModal.saveChanges']()}
						</Button>
					{/if}
				{/if}

				<!-- Divider -->
				<div class="border-t border-border"></div>

				<!-- Actions -->
				<div class="space-y-3">
					<p class="text-sm font-medium text-muted-foreground">
						{m['manageMemberModal.actionsLabel']()}
					</p>

					<!-- Make Staff Button -->
					{#if !isStaff}
						<Button
							variant="outline"
							onclick={handleMakeStaffClick}
							disabled={isProcessing}
							class="w-full justify-start"
						>
							{#if isPromoting}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{:else}
								<UserCog class="mr-2 h-4 w-4" />
							{/if}
							{m['manageMemberModal.makeStaff']()}
						</Button>
					{/if}

					<!-- Remove Member Button/Confirmation -->
					{#if !showRemoveConfirm}
						<Button
							variant="destructive"
							onclick={handleRemoveClick}
							disabled={isProcessing}
							class="w-full justify-start"
						>
							<UserX class="mr-2 h-4 w-4" />
							{m['manageMemberModal.removeMember']()}
						</Button>
					{:else}
						<div class="space-y-2 rounded-lg border border-destructive bg-destructive/10 p-4">
							<div class="flex gap-2">
								<AlertTriangle class="h-5 w-5 shrink-0 text-destructive" />
								<div class="flex-1 space-y-2">
									<p role="heading" aria-level="4" class="text-sm font-medium text-foreground">
										{m['manageMemberModal.removeConfirmTitle']()}
									</p>
									<p class="text-sm text-foreground">
										{m['manageMemberModal.removeConfirmMessage']({ name: displayName })}
									</p>
									{@render billingNotice('text-sm text-foreground')}
									<div class="flex gap-2">
										<Button
											variant="destructive"
											size="sm"
											onclick={handleConfirmRemove}
											disabled={isRemoving}
										>
											{#if isRemoving}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" />
											{/if}
											{m['manageMemberModal.confirmRemove']()}
										</Button>
										<Button
											variant="outline"
											size="sm"
											onclick={handleCancelRemove}
											disabled={isRemoving}
										>
											{m['manageMemberModal.cancelRemove']()}
										</Button>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Blacklist Button/Confirmation -->
					{#if onBlacklist}
						{#if !showBlacklistConfirm}
							<!-- Label stays text-foreground (danger framing rule): meaning is
							     never carried by color alone, and the destructive framing here
							     is a whole sentence. Only the Ban icon carries the tone, and it
							     no longer needs a per-mode split — `text-destructive` resolves
							     to --destructive-text (#781): 8.63:1 light / 7.02:1 dark on the
							     page background, both TEXT_PAIRS rows in
							     scripts/audit-brand-themes.py. Before the split the same
							     utility measured 3.13:1 in dark, under the text floor. Hover
							     keeps the text-foreground label with the /10 tint underneath. -->
							<Button
								variant="outline"
								onclick={handleBlacklistClick}
								disabled={isProcessing}
								class="w-full justify-start border-destructive bg-transparent text-foreground hover:bg-destructive/10 hover:text-foreground"
							>
								<Ban class="mr-2 h-4 w-4 text-destructive" aria-hidden="true" />
								{m['manageMemberModal.addToBlacklist']()}
							</Button>
						{:else}
							<div class="space-y-3 rounded-lg border-2 border-destructive bg-destructive/10 p-4">
								<div class="flex gap-2">
									<Ban class="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
									<div class="flex-1 space-y-3">
										<div>
											<p role="heading" aria-level="4" class="text-sm font-medium text-foreground">
												{m['manageMemberModal.blacklistConfirmTitle']({ name: displayName })}
											</p>
											<p class="text-sm text-foreground">
												{m['manageMemberModal.blacklistConfirmMessage']()}
											</p>
											{@render billingNotice('mt-1 text-sm text-foreground')}
										</div>
										<div class="space-y-2">
											<Label for="blacklist-reason" class="text-sm text-foreground">
												{m['manageMemberModal.reasonOptional']()}
											</Label>
											<Textarea
												id="blacklist-reason"
												bind:value={blacklistReason}
												placeholder={m['manageMemberModal.blacklistReasonPlaceholder']()}
												rows={2}
												disabled={isBlacklisting}
												class="border-destructive/40"
											/>
										</div>
										<div class="flex gap-2">
											<Button
												variant="destructive"
												size="sm"
												onclick={handleConfirmBlacklist}
												disabled={isBlacklisting}
											>
												{#if isBlacklisting}
													<Loader2 class="mr-2 h-4 w-4 animate-spin" />
												{/if}
												{m['manageMemberModal.confirmBlacklist']()}
											</Button>
											<Button
												variant="outline"
												size="sm"
												onclick={handleCancelBlacklist}
												disabled={isBlacklisting}
											>
												{m['manageMemberModal.cancel']()}
											</Button>
										</div>
									</div>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Close Button -->
			<div class="flex justify-end border-t border-border pt-4">
				<Button variant="ghost" onclick={requestClose} disabled={isProcessing}>
					{m['manageMemberModal.close']()}
				</Button>
			</div>
		{/if}
	</DialogContent>
</Dialog>

<ConfirmDialog
	isOpen={showDiscardConfirm}
	title={m['manageMemberModal.discardTitle']()}
	message={m['manageMemberModal.discardMessage']()}
	confirmText={m['manageMemberModal.discardConfirm']()}
	cancelText={m['manageMemberModal.discardKeep']()}
	variant="warning"
	onConfirm={handleDiscard}
	onCancel={() => {
		showDiscardConfirm = false;
		discardThenSubscription = false;
	}}
/>
