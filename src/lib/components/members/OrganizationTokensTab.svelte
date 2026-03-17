<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadmintokensListOrganizationTokens,
		organizationadmintokensCreateOrganizationToken,
		organizationadmintokensUpdateOrganizationToken,
		organizationadmintokensDeleteOrganizationToken
	} from '$lib/api/generated/sdk.gen';
	import type {
		MembershipTierSchema,
		OrganizationTokenSchema,
		OrganizationTokenCreateSchema,
		OrganizationTokenUpdateSchema,
		OrganizationAdminDetailSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Search, Link, Loader2 } from 'lucide-svelte';
	import OrganizationTokenCard from '$lib/components/tokens/OrganizationTokenCard.svelte';
	import OrganizationTokenModal from '$lib/components/tokens/OrganizationTokenModal.svelte';
	import TokenShareDialog from '$lib/components/tokens/TokenShareDialog.svelte';
	import { getOrganizationTokenUrl } from '$lib/utils/tokens';
	import { toast } from 'svelte-sonner';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		isOwner: boolean;
		tiers: MembershipTierSchema[];
		isCreateModalOpen: boolean;
		onCreateModalOpenChange: (open: boolean) => void;
	}

	const { organization, isOwner, tiers, isCreateModalOpen, onCreateModalOpenChange }: Props =
		$props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Local state
	let tokenSearch = $state('');
	let tokenToEdit = $state<OrganizationTokenSchema | null>(null);
	let tokenToDelete = $state<OrganizationTokenSchema | null>(null);
	let tokenToShare = $state<OrganizationTokenSchema | null>(null);

	// Fetch tokens
	const tokensQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'tokens', tokenSearch],
		queryFn: async () => {
			const response = await organizationadmintokensListOrganizationTokens({
				path: { slug: organization.slug },
				query: { search: tokenSearch || undefined, page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch tokens');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Create token mutation
	const createTokenMutation = createMutation(() => ({
		mutationFn: async (tokenData: OrganizationTokenCreateSchema) => {
			const response = await organizationadmintokensCreateOrganizationToken({
				path: { slug: organization.slug },
				body: tokenData,
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to create token');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tokens']
			});
			onCreateModalOpenChange(false);
			toast.success('Invitation link created successfully');
		},
		onError: () => {
			toast.error('Failed to create invitation link');
		}
	}));

	// Update token mutation
	const updateTokenMutation = createMutation(() => ({
		mutationFn: async ({
			tokenId,
			data: tokenData
		}: {
			tokenId: string;
			data: OrganizationTokenUpdateSchema;
		}) => {
			const response = await organizationadmintokensUpdateOrganizationToken({
				path: { slug: organization.slug, token_id: tokenId },
				body: tokenData,
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update token');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tokens']
			});
			tokenToEdit = null;
			toast.success('Invitation link updated successfully');
		},
		onError: () => {
			toast.error('Failed to update invitation link');
		}
	}));

	// Delete token mutation
	const deleteTokenMutation = createMutation(() => ({
		mutationFn: async (tokenId: string) => {
			const response = await organizationadmintokensDeleteOrganizationToken({
				path: { slug: organization.slug, token_id: tokenId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to delete token');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tokens']
			});
			tokenToDelete = null;
			toast.success('Invitation link deleted successfully');
		},
		onError: () => {
			toast.error('Failed to delete invitation link');
		}
	}));

	// Derived data
	const tokens = $derived(tokensQuery.data?.results || []);
	const shareUrl = $derived(
		tokenToShare ? getOrganizationTokenUrl(tokenToShare.id || '', organization.slug) : ''
	);

	// Handlers
	function handleCreateTokenSave(data: OrganizationTokenCreateSchema) {
		createTokenMutation.mutate(data);
	}

	function handleEditTokenSave(data: OrganizationTokenUpdateSchema) {
		if (tokenToEdit?.id) {
			updateTokenMutation.mutate({ tokenId: tokenToEdit.id, data });
		}
	}

	function handleDeleteToken() {
		if (tokenToDelete?.id) {
			deleteTokenMutation.mutate(tokenToDelete.id);
		}
	}
</script>

<!-- Search -->
<div class="relative">
	<Search
		class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
		aria-hidden="true"
	/>
	<Input
		type="search"
		placeholder="Search invitation links..."
		bind:value={tokenSearch}
		class="pl-10"
	/>
</div>

<!-- Tokens List -->
{#if tokensQuery.isLoading}
	<div class="flex items-center justify-center py-12">
		<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
	</div>
{:else if tokensQuery.isError}
	<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
		<p class="text-sm text-destructive">Failed to load invitation links</p>
	</div>
{:else if tokens.length === 0}
	<div class="rounded-lg border border-dashed p-12 text-center">
		<Link class="mx-auto h-12 w-12 text-muted-foreground" />
		<h3 class="mt-4 font-semibold">
			{#if tokenSearch}
				No invitation links found
			{:else}
				No invitation links yet
			{/if}
		</h3>
		<p class="mt-2 text-sm text-muted-foreground">
			{#if tokenSearch}
				Try adjusting your search query
			{:else}
				Create shareable links to invite people to join this organization
			{/if}
		</p>
	</div>
{:else}
	<div class="space-y-4">
		{#each tokens as token (token.id)}
			<OrganizationTokenCard
				{token}
				organizationSlug={organization.slug}
				{isOwner}
				onEdit={(t) => (tokenToEdit = t)}
				onDelete={(t) => (tokenToDelete = t)}
				onShare={(t) => (tokenToShare = t)}
			/>
		{/each}
	</div>
{/if}

<!-- Token Create Modal -->
<OrganizationTokenModal
	open={isCreateModalOpen}
	membershipTiers={tiers}
	{isOwner}
	isLoading={createTokenMutation.isPending}
	onClose={() => onCreateModalOpenChange(false)}
	onSave={handleCreateTokenSave}
/>

<!-- Token Edit Modal -->
<OrganizationTokenModal
	open={!!tokenToEdit}
	token={tokenToEdit}
	membershipTiers={tiers}
	{isOwner}
	isLoading={updateTokenMutation.isPending}
	onClose={() => (tokenToEdit = null)}
	onSave={handleEditTokenSave}
/>

<!-- Token Delete Confirmation -->
<Dialog open={!!tokenToDelete}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Delete Invitation Link</DialogTitle>
			<DialogDescription>
				Are you sure you want to delete this invitation link? This action cannot be undone.
			</DialogDescription>
		</DialogHeader>

		{#if tokenToDelete}
			<div class="space-y-2 text-sm">
				<p>
					<strong>Link:</strong>
					{tokenToDelete.name || 'Unnamed link'}
				</p>
				<p>
					<strong>Uses:</strong>
					{tokenToDelete.uses ?? 0} time{(tokenToDelete.uses ?? 0) === 1 ? '' : 's'}
				</p>
				<p class="text-muted-foreground">Note: People who already joined will keep their access.</p>
			</div>
		{/if}

		<DialogFooter>
			<Button
				variant="outline"
				onclick={() => (tokenToDelete = null)}
				disabled={deleteTokenMutation.isPending}
			>
				Cancel
			</Button>
			<Button
				variant="destructive"
				onclick={handleDeleteToken}
				disabled={deleteTokenMutation.isPending}
			>
				{#if deleteTokenMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				Delete Link
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Token Share Dialog -->
{#if tokenToShare}
	<TokenShareDialog
		open={!!tokenToShare}
		{shareUrl}
		tokenName={tokenToShare.name || undefined}
		onClose={() => (tokenToShare = null)}
	/>
{/if}
