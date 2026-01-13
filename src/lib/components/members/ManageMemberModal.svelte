<script lang="ts">
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
	import { Loader2, UserCog, UserX, AlertTriangle, Ban } from 'lucide-svelte';

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
		isUpdating?: boolean;
		isPromoting?: boolean;
		isRemoving?: boolean;
		isBlacklisting?: boolean;
	}

	let {
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
	let blacklistReason = $state('');

	// Sync form state with member prop
	$effect(() => {
		if (member) {
			selectedStatus = member.status;
			selectedTierId = member.tier?.id || null;
			showRemoveConfirm = false;
			showBlacklistConfirm = false;
			blacklistReason = '';
		}
	});

	// Display name
	let displayName = $derived(
		member
			? member.user.preferred_name ||
					(member.user.first_name && member.user.last_name
						? `${member.user.first_name} ${member.user.last_name}`
						: member.user.first_name || member.user.email || 'Unknown User')
			: ''
	);

	// Check if changes were made
	let hasStatusChanged = $derived(member && selectedStatus !== member.status);
	let hasTierChanged = $derived(member && selectedTierId !== (member.tier?.id || null));
	let hasChanges = $derived(hasStatusChanged || hasTierChanged);

	// Statuses
	const statuses: MembershipStatus[] = ['active', 'paused', 'cancelled', 'banned'];

	function handleSaveChanges() {
		if (!member) return;

		if (hasStatusChanged) {
			onUpdateStatus(selectedStatus);
		}

		if (hasTierChanged) {
			onUpdateTier(selectedTierId);
		}
	}

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
	let isProcessing = $derived(isUpdating || isPromoting || isRemoving || isBlacklisting);

	// Handle dialog open/close changes
	function handleOpenChange(isOpen: boolean) {
		if (!isOpen) {
			onClose();
		}
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
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
						}}
						disabled={isProcessing}
					>
						<SelectTrigger id="status" aria-label={m['manageMemberModal.statusLabel']()}>
							{m[`memberStatus.${selectedStatus}`]()}
						</SelectTrigger>
						<SelectContent>
							{#each statuses as status}
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
					{#if selectedStatus === 'banned'}
						<div class="flex gap-2 rounded-md bg-red-50 p-3 text-sm dark:bg-red-950">
							<AlertTriangle class="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
							<p class="text-red-800 dark:text-red-200">
								{m['manageMemberModal.bannedWarning']()}
							</p>
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
						disabled={isProcessing}
					>
						<SelectTrigger id="tier" aria-label={m['manageMemberModal.tierLabel']()}>
							{selectedTierId
								? tiers.find((t) => t.id === selectedTierId)?.name ||
									m['manageMemberModal.noTier']()
								: m['manageMemberModal.noTier']()}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">{m['manageMemberModal.noTier']()}</SelectItem>
							{#each tiers as tier}
								{#if tier.id}
									<SelectItem value={tier.id}>{tier.name}</SelectItem>
								{/if}
							{/each}
						</SelectContent>
					</Select>
				</div>

				<!-- Save Changes Button -->
				{#if hasChanges}
					<Button onclick={handleSaveChanges} disabled={isProcessing} class="w-full">
						{#if isUpdating}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{/if}
						{m['manageMemberModal.saveChanges']()}
					</Button>
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
									<p class="text-sm font-medium text-destructive">
										{m['manageMemberModal.removeConfirmTitle']()}
									</p>
									<p class="text-sm text-destructive/90">
										{m['manageMemberModal.removeConfirmMessage']({ name: displayName })}
									</p>
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
							<Button
								variant="outline"
								onclick={handleBlacklistClick}
								disabled={isProcessing}
								class="w-full justify-start border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
							>
								<Ban class="mr-2 h-4 w-4" />
								Add to Blacklist
							</Button>
						{:else}
							<div class="space-y-3 rounded-lg border-2 border-red-500 bg-red-50 p-4 dark:bg-red-950/50">
								<div class="flex gap-2">
									<Ban class="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
									<div class="flex-1 space-y-3">
										<div>
											<p class="text-sm font-medium text-red-900 dark:text-red-100">
												Blacklist {displayName}?
											</p>
											<p class="text-sm text-red-800 dark:text-red-200">
												This person will be blocked from all events in this organization.
												They will also be removed as a member.
											</p>
										</div>
										<div class="space-y-2">
											<Label for="blacklist-reason" class="text-sm text-red-900 dark:text-red-100">
												Reason (optional)
											</Label>
											<Textarea
												id="blacklist-reason"
												bind:value={blacklistReason}
												placeholder="Explain why this person is being blacklisted..."
												rows={2}
												disabled={isBlacklisting}
												class="border-red-300 dark:border-red-700"
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
												Confirm Blacklist
											</Button>
											<Button
												variant="outline"
												size="sm"
												onclick={handleCancelBlacklist}
												disabled={isBlacklisting}
											>
												Cancel
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
				<Button variant="ghost" onclick={onClose} disabled={isProcessing}>
					{m['manageMemberModal.close']()}
				</Button>
			</div>
		{/if}
	</DialogContent>
</Dialog>
