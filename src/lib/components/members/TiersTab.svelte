<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminmembersCreateMembershipTier,
		organizationadminmembersUpdateMembershipTier,
		organizationadminmembersDeleteMembershipTier
	} from '$lib/api/generated/sdk.gen';
	import type {
		MembershipTierSchema,
		OrganizationAdminDetailSchema,
		OrganizationMemberSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Shield, Plus, Pencil, Trash2, Loader2 } from 'lucide-svelte';
	import TierFormModal from '$lib/components/members/TierFormModal.svelte';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		tiers: MembershipTierSchema[];
		members: OrganizationMemberSchema[];
		isLoading: boolean;
		isError: boolean;
	}

	let { organization, tiers, members, isLoading, isError }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Tier management state
	let tierToEdit = $state<MembershipTierSchema | null>(null);
	let tierFormOpen = $state(false);
	let tierToDelete = $state<MembershipTierSchema | null>(null);
	let deleteConfirmOpen = $state(false);

	// Create tier mutation
	const createTierMutation = createMutation(() => ({
		mutationFn: async ({ name, description }: { name: string; description: string }) => {
			const response = await organizationadminmembersCreateMembershipTier({
				path: { slug: organization.slug },
				body: { name, description },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to create tier');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'membership-tiers']
			});
		},
		onError: (error: Error) => {
			alert(`Failed to create tier: ${error.message}`);
		}
	}));

	// Update tier mutation
	const updateTierMutation = createMutation(() => ({
		mutationFn: async ({
			tierId,
			name,
			description
		}: {
			tierId: string;
			name: string;
			description: string;
		}) => {
			const response = await organizationadminmembersUpdateMembershipTier({
				path: { slug: organization.slug, tier_id: tierId },
				body: { name, description },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update tier');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'membership-tiers']
			});
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
		},
		onError: (error: Error) => {
			alert(`Failed to update tier: ${error.message}`);
		}
	}));

	// Delete tier mutation
	const deleteTierMutation = createMutation(() => ({
		mutationFn: async (tierId: string) => {
			const response = await organizationadminmembersDeleteMembershipTier({
				path: { slug: organization.slug, tier_id: tierId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to delete tier');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'membership-tiers']
			});
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'members']
			});
		},
		onError: (error: Error) => {
			alert(`Failed to delete tier: ${error.message}`);
		}
	}));

	// Handlers
	function handleCreateTier() {
		tierToEdit = null;
		tierFormOpen = true;
	}

	function handleEditTier(tier: MembershipTierSchema) {
		tierToEdit = tier;
		tierFormOpen = true;
	}

	function handleCloseTierForm() {
		if (!createTierMutation.isPending && !updateTierMutation.isPending) {
			tierFormOpen = false;
			tierToEdit = null;
		}
	}

	function handleSaveTier(name: string, description: string) {
		if (tierToEdit && tierToEdit.id) {
			updateTierMutation.mutate(
				{ tierId: tierToEdit.id, name, description },
				{
					onSuccess: () => {
						tierFormOpen = false;
						tierToEdit = null;
					}
				}
			);
		} else {
			createTierMutation.mutate(
				{ name, description },
				{
					onSuccess: () => {
						tierFormOpen = false;
					}
				}
			);
		}
	}

	function handleDeleteTierClick(tier: MembershipTierSchema) {
		tierToDelete = tier;
		deleteConfirmOpen = true;
	}

	function handleConfirmDelete() {
		if (tierToDelete && tierToDelete.id) {
			deleteTierMutation.mutate(tierToDelete.id, {
				onSuccess: () => {
					deleteConfirmOpen = false;
					tierToDelete = null;
				}
			});
		}
	}

	function handleCancelDelete() {
		if (!deleteTierMutation.isPending) {
			deleteConfirmOpen = false;
			tierToDelete = null;
		}
	}
</script>

<!-- Header with Create Button -->
<div class="flex items-center justify-between">
	<p class="text-sm text-muted-foreground">
		{m['orgAdmin.members.tiers.description']()}
	</p>
	<Button size="sm" onclick={handleCreateTier}>
		<Plus class="mr-2 h-4 w-4" />
		{m['orgAdmin.members.tiers.create']()}
	</Button>
</div>

<!-- Tiers List -->
{#if isLoading}
	<div class="flex items-center justify-center py-12">
		<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
	</div>
{:else if isError}
	<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
		<p class="text-sm text-destructive">{m['orgAdmin.members.errors.loadTiers']()}</p>
	</div>
{:else if tiers.length === 0}
	<div class="rounded-lg border border-dashed p-12 text-center">
		<Shield class="mx-auto h-12 w-12 text-muted-foreground" />
		<h3 class="mt-4 font-semibold">{m['orgAdmin.members.empty.tiers.title']()}</h3>
		<p class="mt-2 text-sm text-muted-foreground">
			{m['orgAdmin.members.empty.tiers.description']()}
		</p>
	</div>
{:else}
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each tiers as tier (tier.id)}
			{@const memberCount = members.filter((mb) => mb.tier?.id === tier.id).length}
			<div class="rounded-lg border border-border bg-card p-4 shadow-sm">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0 flex-1">
						<h3 class="truncate font-semibold text-foreground">
							{tier.name}
						</h3>
						{#if tier.description}
							<p class="mt-2 text-sm text-muted-foreground">
								{tier.description}
							</p>
						{/if}
						<p class="mt-2 text-xs text-muted-foreground">
							{m['orgAdmin.members.tiers.memberCount']({
								count: memberCount,
								plural: memberCount === 1 ? '' : m['orgAdmin.members.tiers._plural']()
							})}
						</p>
					</div>
					<div class="flex shrink-0 gap-1">
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8"
							onclick={() => handleEditTier(tier)}
							aria-label={m['orgAdmin.members.tiers.editAriaLabel']({ name: tier.name })}
						>
							<Pencil class="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 text-destructive"
							onclick={() => handleDeleteTierClick(tier)}
							aria-label={m['orgAdmin.members.tiers.deleteAriaLabel']({ name: tier.name })}
						>
							<Trash2 class="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<!-- Tier Form Modal -->
<TierFormModal
	tier={tierToEdit}
	open={tierFormOpen}
	onClose={handleCloseTierForm}
	onSave={handleSaveTier}
	isSaving={createTierMutation.isPending || updateTierMutation.isPending}
/>

<!-- Delete Tier Confirmation Dialog -->
{#if tierToDelete}
	<Dialog
		open={deleteConfirmOpen}
		onOpenChange={(open) => {
			if (!open) handleCancelDelete();
		}}
	>
		<DialogContent class="sm:max-w-[425px]">
			<DialogHeader>
				<DialogTitle>{m['tierDelete.title']()}</DialogTitle>
			</DialogHeader>
			<div class="space-y-4 py-4">
				<div class="flex gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
					<div class="shrink-0">
						<svg
							class="h-5 w-5 text-destructive"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<div class="flex-1 space-y-2">
						<p class="text-sm font-medium text-destructive">
							{m['tierDelete.confirmMessage']({ name: tierToDelete.name })}
						</p>
						<p class="text-sm text-muted-foreground">
							{m['tierDelete.consequence']()}
						</p>
					</div>
				</div>
				<div class="flex justify-end gap-2">
					<Button
						variant="outline"
						onclick={handleCancelDelete}
						disabled={deleteTierMutation.isPending}
					>
						{m['tierDelete.cancel']()}
					</Button>
					<Button
						variant="destructive"
						onclick={handleConfirmDelete}
						disabled={deleteTierMutation.isPending}
					>
						{#if deleteTierMutation.isPending}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{/if}
						{m['tierDelete.confirm']()}
					</Button>
				</div>
			</div>
		</DialogContent>
	</Dialog>
{/if}
