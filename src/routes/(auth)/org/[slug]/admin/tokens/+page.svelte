<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadminListOrganizationTokens,
		organizationadminCreateOrganizationToken,
		organizationadminUpdateOrganizationToken,
		organizationadminDeleteOrganizationToken,
		organizationadminListMembershipTiers
	} from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationTokenSchema,
		OrganizationTokenCreateSchema,
		OrganizationTokenUpdateSchema,
		MembershipTierSchema
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
	import * as m from '$lib/paraglide/messages.js';

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
				throw new Error(m['orgAdminTokensPage.error_fetchFailed']());
			}

			return response.data;
		},
		enabled: !!accessToken
	}));

	// Fetch membership tiers
	const tiersQuery = createQuery(() => ({
		queryKey: ['organization', organization.slug, 'membership-tiers'],
		queryFn: async () => {
			const response = await organizationadminListMembershipTiers({
				path: { slug: organization.slug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to fetch membership tiers');
			}

			return response.data || [];
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
				throw new Error(m['orgAdminTokensPage.error_createFailed']());
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tokens']
			});
			isCreateModalOpen = false;
			toast.success(m['orgAdminTokensPage.toast_created']());
		},
		onError: () => {
			toast.error(m['orgAdminTokensPage.toast_error_create']());
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
				throw new Error(m['orgAdminTokensPage.error_updateFailed']());
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tokens']
			});
			tokenToEdit = null;
			toast.success(m['orgAdminTokensPage.toast_updated']());
		},
		onError: () => {
			toast.error(m['orgAdminTokensPage.toast_error_update']());
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
				throw new Error(m['orgAdminTokensPage.error_deleteFailed']());
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['organization', organization.slug, 'tokens']
			});
			tokenToDelete = null;
			toast.success(m['orgAdminTokensPage.toast_deleted']());
		},
		onError: () => {
			toast.error(m['orgAdminTokensPage.toast_error_delete']());
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
	const membershipTiers = $derived(tiersQuery.data || []);
	const isLoading = $derived(tokensQuery.isLoading);
	const shareUrl = $derived(
		tokenToShare ? getOrganizationTokenUrl(tokenToShare.id || '', organization.slug) : ''
	);
</script>

<svelte:head>
	<title>{m['orgAdminTokensPage.pageTitle']({ organizationName: organization.name })}</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">{m['orgAdminTokensPage.title']()}</h1>
			<p class="text-muted-foreground">
				{m['orgAdminTokensPage.subtitle']()}
			</p>
		</div>
		<Button onclick={() => (isCreateModalOpen = true)}>
			<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
			{m['orgAdminTokensPage.createButton']()}
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
			placeholder={m['orgAdminTokensPage.searchPlaceholder']()}
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
				<h3 class="text-lg font-semibold">{m['orgAdminTokensPage.empty_noLinks_title']()}</h3>
				<p class="mt-2 text-sm text-muted-foreground">
					{#if searchQuery}
						{m['orgAdminTokensPage.empty_noLinks_search']()}
					{:else}
						{m['orgAdminTokensPage.empty_noLinks_initial']()}
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
	{membershipTiers}
	isLoading={createTokenMutation.isPending}
	onClose={() => (isCreateModalOpen = false)}
	onSave={handleCreateSave}
/>

<!-- Edit Modal -->
<OrganizationTokenModal
	open={!!tokenToEdit}
	token={tokenToEdit}
	{membershipTiers}
	isLoading={updateTokenMutation.isPending}
	onClose={() => (tokenToEdit = null)}
	onSave={handleEditSave}
/>

<!-- Delete Confirmation -->
<Dialog open={!!tokenToDelete}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>{m['orgAdminTokensPage.delete_title']()}</DialogTitle>
			<DialogDescription>
				{m['orgAdminTokensPage.delete_description']()}
			</DialogDescription>
		</DialogHeader>

		{#if tokenToDelete}
			<div class="space-y-2 text-sm">
				<p>
					<strong>{m['orgAdminTokensPage.delete_linkLabel']()}</strong>
					{tokenToDelete.name || m['orgAdminTokensPage.delete_unnamedLink']()}
				</p>
				<p>
					<strong>{m['orgAdminTokensPage.delete_usesLabel']()}</strong>
					{m['orgAdminTokensPage.delete_usesDescription']({
						count: tokenToDelete.uses ?? 0,
						plural:
							(tokenToDelete.uses ?? 0) === 1
								? ''
								: m['orgAdminTokensPage.delete_usesDescription_plural']()
					})}
				</p>
				<p class="text-muted-foreground">
					{m['orgAdminTokensPage.delete_keepAccessNote']()}
				</p>
			</div>
		{/if}

		<DialogFooter>
			<Button
				variant="outline"
				onclick={() => (tokenToDelete = null)}
				disabled={deleteTokenMutation.isPending}
			>
				{m['orgAdminTokensPage.delete_cancelButton']()}
			</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={deleteTokenMutation.isPending}>
				{#if deleteTokenMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['orgAdminTokensPage.delete_confirmButton']()}
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
