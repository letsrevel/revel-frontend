<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { eventadminUpdateTicketTier } from '$lib/api/generated/sdk.gen';
	import type {
		TicketTierDetailSchema,
		TicketTierUpdateSchema
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';

	interface Props {
		tier: TicketTierDetailSchema | null; // null = create new (Phase 2)
		eventId: string;
		organizationStripeConnected: boolean;
		onClose: () => void;
	}

	let { tier, eventId, organizationStripeConnected, onClose }: Props = $props();

	const queryClient = useQueryClient();

	// Form state - Phase 1: Edit only (name and description)
	let name = $state(tier?.name ?? '');
	let description = $state(tier?.description ?? '');

	const updateMutation = createMutation({
		mutationFn: (data: TicketTierUpdateSchema) =>
			eventadminUpdateTicketTier({
				path: { event_id: eventId, tier_id: tier!.id },
				body: data
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	});

	function handleSubmit(e: Event) {
		e.preventDefault();

		if (!tier) {
			// Phase 2: Handle tier creation
			return;
		}

		$updateMutation.mutate({
			name: name.trim(),
			description: description.trim() || null
		});
	}
</script>

<Dialog open onOpenChange={onClose}>
	<DialogContent class="sm:max-w-[500px]">
		<DialogHeader>
			<DialogTitle>{tier ? 'Edit Ticket Tier' : 'Create Ticket Tier'}</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Tier Name -->
			<div>
				<Label for="tier-name">
					Tier Name <span class="text-destructive">*</span>
				</Label>
				<Input
					id="tier-name"
					bind:value={name}
					required
					maxlength={150}
					placeholder="e.g., General Admission, VIP Pass"
					disabled={$updateMutation.isPending}
				/>
			</div>

			<!-- Description -->
			<div>
				<Label for="tier-description">Description (optional)</Label>
				<Textarea
					id="tier-description"
					bind:value={description}
					rows={3}
					placeholder="What's included in this tier?"
					disabled={$updateMutation.isPending}
				/>
			</div>

			<!-- Phase 1: Show payment method as read-only -->
			{#if tier}
				<div>
					<Label>Payment Method</Label>
					<div class="rounded-md bg-muted p-3 text-sm capitalize">
						{tier.payment_method.replace(/_/g, ' ')}
					</div>
					<p class="mt-1 text-xs text-muted-foreground">
						Payment method cannot be changed after tier is created
					</p>
				</div>
			{/if}

			<!-- Form Actions -->
			<div class="flex justify-end gap-2 pt-4">
				<Button
					type="button"
					variant="outline"
					onclick={onClose}
					disabled={$updateMutation.isPending}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={$updateMutation.isPending || !name.trim()}>
					{$updateMutation.isPending ? 'Saving...' : 'Save Changes'}
				</Button>
			</div>

			{#if $updateMutation.isError}
				<div class="rounded-lg bg-destructive/10 p-3" role="alert">
					<p class="text-sm text-destructive">
						{$updateMutation.error?.message || 'Error saving tier. Please try again.'}
					</p>
				</div>
			{/if}
		</form>
	</DialogContent>
</Dialog>
