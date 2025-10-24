<script lang="ts">
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventadminCreateTicketTier,
		eventadminUpdateTicketTier,
		eventadminDeleteTicketTier
	} from '$lib/api/generated/sdk.gen';
	import type {
		TicketTierDetailSchema,
		TicketTierCreateSchema,
		TicketTierUpdateSchema
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';

	interface Props {
		tier: TicketTierDetailSchema | null; // null = create new
		eventId: string;
		organizationStripeConnected: boolean;
		onClose: () => void;
	}

	let { tier, eventId, organizationStripeConnected, onClose }: Props = $props();

	const queryClient = useQueryClient();

	// Form state
	let name = $state(tier?.name ?? '');
	let description = $state(tier?.description ?? '');
	let paymentMethod = $state<'free' | 'offline' | 'at_the_door' | 'online'>(
		tier?.payment_method ?? 'free'
	);
	let priceType = $state<'fixed' | 'pwyc'>(tier?.price_type ?? 'fixed');
	let price = $state(tier?.price ? String(tier.price) : '0');
	let pwycMin = $state(tier?.pwyc_min ? String(tier.pwyc_min) : '1');
	let pwycMax = $state(tier?.pwyc_max ? String(tier.pwyc_max) : '');
	let totalQuantity = $state<string>(
		tier?.total_quantity !== null && tier?.total_quantity !== undefined
			? String(tier.total_quantity)
			: ''
	);
	let salesStartAt = $state(tier?.sales_start_at ?? '');
	let salesEndAt = $state(tier?.sales_end_at ?? '');
	let visibility = $state<'public' | 'private' | 'members-only' | 'staff-only'>(
		tier?.visibility ?? 'public'
	);
	let purchasableBy = $state<'public' | 'members' | 'invited' | 'invited_and_members'>(
		tier?.purchasable_by ?? 'public'
	);

	const tierCreateMutation = createMutation(() => ({
		mutationFn: (data: TicketTierCreateSchema) =>
			eventadminCreateTicketTier({
				path: { event_id: eventId },
				body: data
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	const tierUpdateMutation = createMutation(() => ({
		mutationFn: (data: TicketTierUpdateSchema) =>
			eventadminUpdateTicketTier({
				path: { event_id: eventId, tier_id: tier!.id },
				body: data
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	const tierDeleteMutation = createMutation(() => ({
		mutationFn: () =>
			eventadminDeleteTicketTier({
				path: { event_id: eventId, tier_id: tier!.id }
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
			onClose();
		}
	}));

	function handleSubmit(e: Event) {
		e.preventDefault();

		const baseData = {
			name: name.trim(),
			description: description.trim() || null,
			payment_method: paymentMethod,
			price_type: priceType,
			price: paymentMethod === 'free' ? '0' : price,
			pwyc_min: priceType === 'pwyc' ? pwycMin : null,
			pwyc_max: priceType === 'pwyc' && pwycMax ? pwycMax : null,
			total_quantity: totalQuantity ? parseInt(totalQuantity) : null,
			sales_start_at: salesStartAt || null,
			sales_end_at: salesEndAt || null,
			visibility,
			purchasable_by: purchasableBy
		};

		if (!tier) {
			// Create new tier
			tierCreateMutation.mutate(baseData as TicketTierCreateSchema);
		} else {
			// Update existing tier
			tierUpdateMutation.mutate(baseData as TicketTierUpdateSchema);
		}
	}

	function handleDelete() {
		if (!tier) return;
		if (!confirm(`Are you sure you want to delete the "${tier.name}" tier?`)) return;
		tierDeleteMutation.mutate();
	}

	let isPending = $derived(
		tierCreateMutation.isPending || tierUpdateMutation.isPending || tierDeleteMutation.isPending
	);
	let error = $derived(
		tierCreateMutation.error || tierUpdateMutation.error || tierDeleteMutation.error
	);
</script>

<Dialog open onOpenChange={onClose}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
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
					disabled={isPending}
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
					disabled={isPending}
				/>
			</div>

			<!-- Payment Method -->
			<div>
				<Label for="payment-method">Payment Method <span class="text-destructive">*</span></Label>
				<select
					id="payment-method"
					bind:value={paymentMethod}
					disabled={isPending}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<option value="free">Free</option>
					<option value="offline">Offline (Manual Payment)</option>
					<option value="at_the_door">At the Door</option>
					<option value="online" disabled={!organizationStripeConnected}>
						Online (Stripe) {!organizationStripeConnected ? '- Not Connected' : ''}
					</option>
				</select>
				<p class="mt-1 text-xs text-muted-foreground">
					{#if paymentMethod === 'free'}
						No payment required for this tier
					{:else if paymentMethod === 'offline'}
						Tickets marked as paid manually by admins
					{:else if paymentMethod === 'at_the_door'}
						Payment collected on-site during check-in
					{:else if paymentMethod === 'online'}
						Online payment via Stripe
					{/if}
				</p>
			</div>

			<!-- Price Settings (if not free) -->
			{#if paymentMethod !== 'free'}
				<div>
					<Label for="price-type">Price Type <span class="text-destructive">*</span></Label>
					<select
						id="price-type"
						bind:value={priceType}
						disabled={isPending}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						<option value="fixed">Fixed Price</option>
						<option value="pwyc">Pay What You Can</option>
					</select>
				</div>

				{#if priceType === 'fixed'}
					<div>
						<Label for="price">Price <span class="text-destructive">*</span></Label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
							<Input
								id="price"
								type="number"
								step="0.01"
								min="0"
								bind:value={price}
								required
								disabled={isPending}
								class="pl-7"
							/>
						</div>
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-4">
						<div>
							<Label for="pwyc-min">Minimum Price <span class="text-destructive">*</span></Label>
							<div class="relative">
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span
								>
								<Input
									id="pwyc-min"
									type="number"
									step="0.01"
									min="1"
									bind:value={pwycMin}
									required
									disabled={isPending}
									class="pl-7"
								/>
							</div>
						</div>
						<div>
							<Label for="pwyc-max">Maximum Price (optional)</Label>
							<div class="relative">
								<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span
								>
								<Input
									id="pwyc-max"
									type="number"
									step="0.01"
									min="1"
									bind:value={pwycMax}
									disabled={isPending}
									class="pl-7"
									placeholder="No limit"
								/>
							</div>
						</div>
					</div>
				{/if}
			{/if}

			<!-- Total Quantity -->
			<div>
				<Label for="total-quantity">Total Tickets Available</Label>
				<Input
					id="total-quantity"
					type="number"
					min="1"
					bind:value={totalQuantity}
					placeholder="Unlimited"
					disabled={isPending}
				/>
				<p class="mt-1 text-xs text-muted-foreground">Leave empty for unlimited tickets</p>
			</div>

			<!-- Sales Period -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="sales-start">Sales Start</Label>
					<Input
						id="sales-start"
						type="datetime-local"
						bind:value={salesStartAt}
						disabled={isPending}
					/>
				</div>
				<div>
					<Label for="sales-end">Sales End</Label>
					<Input
						id="sales-end"
						type="datetime-local"
						bind:value={salesEndAt}
						disabled={isPending}
					/>
				</div>
			</div>

			<!-- Visibility -->
			<div>
				<Label for="visibility">Visibility <span class="text-destructive">*</span></Label>
				<select
					id="visibility"
					bind:value={visibility}
					disabled={isPending}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<option value="public">Public</option>
					<option value="private">Private</option>
					<option value="members-only">Members Only</option>
					<option value="staff-only">Staff Only</option>
				</select>
			</div>

			<!-- Purchasable By -->
			<div>
				<Label for="purchasable-by">Who Can Purchase <span class="text-destructive">*</span></Label>
				<select
					id="purchasable-by"
					bind:value={purchasableBy}
					disabled={isPending}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<option value="public">Anyone</option>
					<option value="members">Members Only</option>
					<option value="invited">Invited Only</option>
					<option value="invited_and_members">Invited + Members</option>
				</select>
			</div>

			<!-- Form Actions -->
			<div class="flex justify-between gap-2 border-t border-border pt-4">
				<div>
					{#if tier}
						<Button type="button" variant="destructive" onclick={handleDelete} disabled={isPending}>
							{tierDeleteMutation.isPending ? 'Deleting...' : 'Delete Tier'}
						</Button>
					{/if}
				</div>
				<div class="flex gap-2">
					<Button type="button" variant="outline" onclick={onClose} disabled={isPending}>
						Cancel
					</Button>
					<Button type="submit" disabled={isPending || !name.trim()}>
						{isPending ? 'Saving...' : tier ? 'Save Changes' : 'Create Tier'}
					</Button>
				</div>
			</div>

			{#if error}
				<div class="rounded-lg bg-destructive/10 p-3" role="alert">
					<p class="text-sm text-destructive">
						{error?.message || 'An error occurred. Please try again.'}
					</p>
				</div>
			{/if}
		</form>
	</DialogContent>
</Dialog>
