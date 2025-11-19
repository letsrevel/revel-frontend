<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		OrganizationMembershipRequestRetrieve,
		MembershipTierSchema
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { CheckCircle, Loader2 } from 'lucide-svelte';

	interface Props {
		request: OrganizationMembershipRequestRetrieve | null;
		tiers: MembershipTierSchema[];
		open: boolean;
		onClose: () => void;
		onConfirm: (tierId: string) => void;
		isProcessing?: boolean;
	}

	let { request, tiers, open, onClose, onConfirm, isProcessing = false }: Props = $props();

	// Selected tier
	let selectedTierId = $state<string | null>(null);

	// Reset selection when modal opens with new request
	$effect(() => {
		if (open && request) {
			// If there's only one tier, auto-select it
			if (tiers.length === 1 && tiers[0].id) {
				selectedTierId = tiers[0].id;
			} else {
				selectedTierId = null;
			}
		}
	});

	// Display name
	let displayName = $derived(
		request
			? request.user.preferred_name ||
					(request.user.first_name && request.user.last_name
						? `${request.user.first_name} ${request.user.last_name}`
						: request.user.first_name || request.user.email || 'Unknown User')
			: ''
	);

	function handleConfirm() {
		if (selectedTierId) {
			onConfirm(selectedTierId);
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
		{#if request}
			<DialogHeader>
				<DialogTitle>{m['approveMembershipModal.title']()}</DialogTitle>
			</DialogHeader>

			<div class="space-y-4 py-4">
				<p class="text-sm text-muted-foreground">
					{m['approveMembershipModal.description']({ name: displayName })}
				</p>

				<!-- Tier Selection -->
				<div class="space-y-2">
					<Label for="tier">{m['approveMembershipModal.tierLabel']()}</Label>
					<Select
						type="single"
						value={selectedTierId || 'none'}
						onValueChange={(value) => {
							selectedTierId = value === 'none' ? null : value;
						}}
						disabled={isProcessing}
					>
						<SelectTrigger id="tier" aria-label={m['approveMembershipModal.tierLabel']()}>
							{selectedTierId
								? tiers.find((t) => t.id === selectedTierId)?.name ||
									m['approveMembershipModal.selectTier']()
								: m['approveMembershipModal.selectTier']()}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none" disabled>
								{m['approveMembershipModal.selectTier']()}
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
						{m['approveMembershipModal.tierHelp']()}
					</p>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={onClose} disabled={isProcessing}>
					{m['approveMembershipModal.cancel']()}
				</Button>
				<Button
					onclick={handleConfirm}
					disabled={!selectedTierId || isProcessing}
					class="bg-green-600 hover:bg-green-700"
				>
					{#if isProcessing}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}
						<CheckCircle class="mr-2 h-4 w-4" />
					{/if}
					{m['approveMembershipModal.approve']()}
				</Button>
			</div>
		{/if}
	</DialogContent>
</Dialog>
