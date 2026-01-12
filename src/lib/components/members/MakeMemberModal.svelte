<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { UserPlus, Loader2 } from 'lucide-svelte';

	interface UserInfo {
		id: string;
		displayName: string;
		email?: string;
	}

	interface Props {
		user: UserInfo | null;
		tiers: MembershipTierSchema[];
		open: boolean;
		onClose: () => void;
		onConfirm: (userId: string, tierId: string) => void;
		isProcessing?: boolean;
	}

	let { user, tiers, open, onClose, onConfirm, isProcessing = false }: Props = $props();

	// Selected tier
	let selectedTierId = $state<string | null>(null);

	// Reset selection when modal opens with new user
	$effect(() => {
		if (open && user) {
			// If there's only one tier, auto-select it
			if (tiers.length === 1 && tiers[0].id) {
				selectedTierId = tiers[0].id;
			} else {
				selectedTierId = null;
			}
		}
	});

	function handleConfirm() {
		if (user && selectedTierId) {
			onConfirm(user.id, selectedTierId);
		}
	}

	function handleOpenChange(isOpen: boolean) {
		if (!isOpen && !isProcessing) {
			onClose();
		}
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent class="sm:max-w-[425px]">
		{#if user}
			<DialogHeader>
				<DialogTitle>{m['makeMemberModal.title']()}</DialogTitle>
			</DialogHeader>

			<div class="space-y-4 py-4">
				<p class="text-sm text-muted-foreground">
					{m['makeMemberModal.description']({ name: user.displayName })}
				</p>

				{#if user.email}
					<p class="text-sm text-muted-foreground">{user.email}</p>
				{/if}

				<!-- Tier Selection -->
				{#if tiers.length === 0}
					<div
						class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
					>
						{m['makeMemberModal.noTiersWarning']()}
					</div>
				{:else}
					<div class="space-y-2">
						<Label for="tier">{m['makeMemberModal.tierLabel']()}</Label>
						<Select
							type="single"
							value={selectedTierId || 'none'}
							onValueChange={(value) => {
								selectedTierId = value === 'none' ? null : value;
							}}
							disabled={isProcessing}
						>
							<SelectTrigger id="tier" aria-label={m['makeMemberModal.tierLabel']()}>
								{selectedTierId
									? tiers.find((t) => t.id === selectedTierId)?.name ||
										m['makeMemberModal.selectTier']()
									: m['makeMemberModal.selectTier']()}
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none" disabled>
									{m['makeMemberModal.selectTier']()}
								</SelectItem>
								{#each tiers as tier}
									{#if tier.id}
										<SelectItem value={tier.id}>
											{tier.name}
											{#if tier.description}
												<span class="ml-2 text-xs text-muted-foreground">
													- {tier.description}
												</span>
											{/if}
										</SelectItem>
									{/if}
								{/each}
							</SelectContent>
						</Select>
						<p class="text-xs text-muted-foreground">
							{m['makeMemberModal.tierHelp']()}
						</p>
					</div>
				{/if}
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={onClose} disabled={isProcessing}>
					{m['makeMemberModal.cancel']()}
				</Button>
				<Button
					onclick={handleConfirm}
					disabled={!selectedTierId || isProcessing || tiers.length === 0}
				>
					{#if isProcessing}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}
						<UserPlus class="mr-2 h-4 w-4" />
					{/if}
					{m['makeMemberModal.confirm']()}
				</Button>
			</div>
		{/if}
	</DialogContent>
</Dialog>
