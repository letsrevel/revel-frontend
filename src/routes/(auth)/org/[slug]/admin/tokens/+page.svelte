<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminListOrganizationTokens,
		organizationadminCreateOrganizationToken,
		organizationadminUpdateOrganizationToken,
		organizationadminDeleteOrganizationToken
	} from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationTokenSchema,
		OrganizationTokenCreateSchema,
		OrganizationTokenUpdateSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Plus, Search, Loader2 } from 'lucide-svelte';
	import OrganizationTokenCard from '$lib/components/tokens/OrganizationTokenCard.svelte';
	import OrganizationTokenModal from '$lib/components/tokens/OrganizationTokenModal.svelte';
	import TokenShareDialog from '$lib/components/tokens/TokenShareDialog.svelte';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { getOrganizationTokenUrl } from '$lib/utils/tokens';
	import { toast } from 'svelte-sonner';

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// UI state
	let searchQuery = $state('');
	let isCreateModalOpen = $state(false);
	let tokenToEdit = $state<OrganizationTokenSchema | null>(null);
	let tokenToDelete = $state<OrganizationTokenSchema | null>(null);
	let tokenToShare = $state<OrganizationTokenSchema | null>(null);

	// Fetch tokens
	const tokensQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'tokens', searchQuery],
		queryFn: async () => {
			const response = await organizationadminListOrganizationTokens({
				path: { slug: organization.slug },
				query: { search: searchQuery || undefined, page_size: 100 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch tokens');
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Create mutation
	const createTokenMutation = createMutation(() => ({
		mutationFn: async (tokenData: OrganizationTokenCreateSchema) => {
			const response = await organizationadminCreateOrganizationToken({
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
			isCreateModalOpen = false;
			toast.success('Invitation link created successfully!');
		},
		onError: () => {
			toast.error('Failed to create invitation link');
		}
	}));

	// Update mutation
	const updateTokenMutation = createMutation(() => ({
		mutationFn: async ({
			tokenId,
			data: tokenData
		}: {
			tokenId: string;
			data: OrganizationTokenUpdateSchema;
		}) => {
			const response = await organizationadminUpdateOrganizationToken({
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
			toast.success('Invitation link updated successfully!');
		},
		onError: () => {
			toast.error('Failed to update invitation link');
		}
	}));

	// Delete mutation
	const deleteTokenMutation = createMutation(() => ({
		mutationFn: async (tokenId: string) => {
			const response = await organizationadminDeleteOrganizationToken({
				path: { slug: organization.slug, token_id: tokenId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to delete link');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tokens']
			});
			tokenToDelete = null;
			toast.success('Invitation link deleted successfully!');
		},
		onError: () => {
			toast.error('Failed to delete invitation link');
		}
	}));

	function handleCreateSave(data: OrganizationTokenCreateSchema) {
		createTokenMutation.mutate(data);
	}

	function handleEditSave(data: OrganizationTokenUpdateSchema) {
		if (tokenToEdit?.id) {
			updateTokenMutation.mutate({ tokenId: tokenToEdit.id, data });
		}
	}

	function handleDelete() {
		if (tokenToDelete?.id) {
			deleteTokenMutation.mutate(tokenToDelete.id);
		}
	}

	const tokens = $derived(tokensQuery.data?.results || []);
	const isLoading = $derived(tokensQuery.isLoading);
	const shareUrl = $derived(
		tokenToShare ? getOrganizationTokenUrl(tokenToShare.id || '', organization.slug) : ''
	);
</script>

<svelte:head>
	<title>Invitation Links - {organization.name}</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Invitation Links</h1>
			<p class="text-muted-foreground">
				Create and manage shareable invitation links for your organization
			</p>
		</div>
		<Button onclick={() => (isCreateModalOpen = true)}>
			<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
			Create Link
		</Button>
	</div>

	<!-- Search -->
	<div class="relative">
		<Search
			class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<Input
			type="search"
			placeholder="Search links by name..."
			bind:value={searchQuery}
			class="pl-10"
		/>
	</div>

	<!-- Links List -->
	<div class="space-y-4">
		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
			</div>
		{:else if tokens.length === 0}
			<div class="rounded-lg border border-dashed p-12 text-center">
				<h3 class="text-lg font-semibold">No links found</h3>
				<p class="mt-2 text-sm text-muted-foreground">
					{#if searchQuery}
						No links match your search. Try a different search term.
					{:else}
						Create your first invitation link to start sharing your organization.
					{/if}
				</p>
			</div>
		{:else}
			{#each tokens as token (token.id)}
				<OrganizationTokenCard
					{token}
					organizationSlug={organization.slug}
					onEdit={(t) => (tokenToEdit = t)}
					onDelete={(t) => (tokenToDelete = t)}
					onShare={(t) => (tokenToShare = t)}
				/>
			{/each}
		{/if}
	</div>
</div>

<!-- Create Modal -->
<OrganizationTokenModal
	open={isCreateModalOpen}
	isLoading={createTokenMutation.isPending}
	onClose={() => (isCreateModalOpen = false)}
	onSave={handleCreateSave}
/>

<!-- Edit Modal -->
<OrganizationTokenModal
	open={!!tokenToEdit}
	token={tokenToEdit}
	isLoading={updateTokenMutation.isPending}
	onClose={() => (tokenToEdit = null)}
	onSave={handleEditSave}
/>

<!-- Delete Confirmation -->
<Dialog open={!!tokenToDelete}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Delete Invitation Link?</DialogTitle>
			<DialogDescription>
				This will permanently disable the invitation link. No one will be able to use it to join.
			</DialogDescription>
		</DialogHeader>

		{#if tokenToDelete}
			<div class="space-y-2 text-sm">
				<p><strong>Link:</strong> {tokenToDelete.name || 'Unnamed Link'}</p>
				<p><strong>Uses:</strong> {tokenToDelete.uses} people already joined using this link</p>
				<p class="text-muted-foreground">
					Those members/staff will keep their access. Only new attempts will fail.
				</p>
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
			<Button variant="destructive" onclick={handleDelete} disabled={deleteTokenMutation.isPending}>
				{#if deleteTokenMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				Delete Link
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<!-- Share Dialog -->
{#if tokenToShare}
	<TokenShareDialog
		open={!!tokenToShare}
		{shareUrl}
		tokenName={tokenToShare.name || undefined}
		onClose={() => (tokenToShare = null)}
	/>
{/if}
