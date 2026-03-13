<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventTokenSchema,
		EventTokenCreateSchema,
		EventTokenUpdateSchema
	} from '$lib/api/generated/types.gen';
	import { Search, Plus, Link, Loader2 } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventadmintokensListEventTokens,
		eventadmintokensCreateEventToken,
		eventadmintokensUpdateEventToken,
		eventadmintokensDeleteEventToken
	} from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import EventTokenCard from '$lib/components/tokens/EventTokenCard.svelte';
	import EventTokenModal from '$lib/components/tokens/EventTokenModal.svelte';
	import TokenShareDialog from '$lib/components/tokens/TokenShareDialog.svelte';
	import { getEventTokenUrl } from '$lib/utils/tokens';

	interface Props {
		eventId: string;
		orgSlug: string;
		eventSlug: string;
	}

	let { eventId, orgSlug, eventSlug }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	let tokenSearchQuery = $state('');
	let isCreateTokenModalOpen = $state(false);
	let tokenToEdit = $state<EventTokenSchema | null>(null);
	let tokenToDelete = $state<EventTokenSchema | null>(null);
	let tokenToShare = $state<EventTokenSchema | null>(null);

	// Fetch tokens
	const tokensQuery = createQuery(() => ({
		queryKey: ['event', eventId, 'tokens', tokenSearchQuery],
		queryFn: async () => {
			const response = await eventadmintokensListEventTokens({
				path: { event_id: eventId },
				query: { search: tokenSearchQuery || undefined, page_size: 100 },
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
		mutationFn: async (tokenData: EventTokenCreateSchema) => {
			const response = await eventadmintokensCreateEventToken({
				path: { event_id: eventId },
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
				queryKey: ['event', eventId, 'tokens']
			});
			isCreateTokenModalOpen = false;
			toast.success('Invitation link created successfully!');
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
			data: EventTokenUpdateSchema;
		}) => {
			const response = await eventadmintokensUpdateEventToken({
				path: { event_id: eventId, token_id: tokenId },
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
				queryKey: ['event', eventId, 'tokens']
			});
			tokenToEdit = null;
			toast.success('Invitation link updated successfully!');
		},
		onError: () => {
			toast.error('Failed to update invitation link');
		}
	}));

	// Delete token mutation
	const deleteTokenMutation = createMutation(() => ({
		mutationFn: async (tokenId: string) => {
			const response = await eventadmintokensDeleteEventToken({
				path: { event_id: eventId, token_id: tokenId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to delete token');
			}

			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['event', eventId, 'tokens']
			});
			tokenToDelete = null;
			toast.success('Invitation link deleted successfully!');
		},
		onError: () => {
			toast.error('Failed to delete invitation link');
		}
	}));

	function handleCreateTokenSave(tokenData: EventTokenCreateSchema) {
		createTokenMutation.mutate(tokenData);
	}

	function handleEditTokenSave(tokenData: EventTokenUpdateSchema) {
		if (tokenToEdit?.id) {
			updateTokenMutation.mutate({ tokenId: tokenToEdit.id, data: tokenData });
		}
	}

	function handleDeleteToken() {
		if (tokenToDelete?.id) {
			deleteTokenMutation.mutate(tokenToDelete.id);
		}
	}

	const tokens = $derived(tokensQuery.data?.results || []);
	const isLoadingTokens = $derived(tokensQuery.isLoading);
	const shareUrl = $derived(tokenToShare ? getEventTokenUrl(tokenToShare.id || '') : '');
</script>

<div class="space-y-6">
	<!-- Header & Action -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<p class="text-sm text-muted-foreground">
			{m['eventInvitationsAdmin.linksDescription']()}
		</p>
		<Button onclick={() => (isCreateTokenModalOpen = true)}>
			<Plus class="mr-2 h-4 w-4" aria-hidden="true" />
			{m['eventInvitationsAdmin.createLink']()}
		</Button>
	</div>

	<!-- Search -->
	<div class="relative">
		<Search
			class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<input
			type="search"
			placeholder={m['eventInvitationsAdmin.searchLinksPlaceholder']()}
			bind:value={tokenSearchQuery}
			class="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		/>
	</div>

	<!-- Tokens List -->
	<div class="space-y-4">
		{#if isLoadingTokens}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
			</div>
		{:else if tokens.length === 0}
			<div class="rounded-lg border border-dashed p-12 text-center">
				<Link class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
				<h3 class="mt-4 text-lg font-semibold">{m['eventInvitationsAdmin.noLinksFound']()}</h3>
				<p class="mt-2 text-sm text-muted-foreground">
					{#if tokenSearchQuery}
						{m['eventInvitationsAdmin.noLinksSearch']()}
					{:else}
						{m['eventInvitationsAdmin.noLinksEmpty']()}
					{/if}
				</p>
			</div>
		{:else}
			{#each tokens as token (token.id)}
				<EventTokenCard
					{token}
					{orgSlug}
					{eventSlug}
					onEdit={(t) => (tokenToEdit = t)}
					onDelete={(t) => (tokenToDelete = t)}
					onShare={(t) => (tokenToShare = t)}
				/>
			{/each}
		{/if}
	</div>
</div>

<!-- Create Token Modal -->
<EventTokenModal
	open={isCreateTokenModalOpen}
	isLoading={createTokenMutation.isPending}
	onClose={() => (isCreateTokenModalOpen = false)}
	onSave={handleCreateTokenSave}
/>

<!-- Edit Token Modal -->
<EventTokenModal
	open={!!tokenToEdit}
	token={tokenToEdit}
	isLoading={updateTokenMutation.isPending}
	onClose={() => (tokenToEdit = null)}
	onSave={handleEditTokenSave}
/>

<!-- Delete Token Confirmation -->
<Dialog.Root open={!!tokenToDelete}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m['eventInvitationsAdmin.deleteTokenTitle']()}</Dialog.Title>
			<Dialog.Description>
				{m['eventInvitationsAdmin.deleteTokenDescription']()}
			</Dialog.Description>
		</Dialog.Header>

		{#if tokenToDelete}
			<div class="space-y-2 text-sm">
				<p>
					<strong>{m['eventInvitationsAdmin.deleteTokenLink']()}</strong>
					{tokenToDelete.name || m['eventInvitationsAdmin.deleteTokenUnnamed']()}
				</p>
				<p>
					<strong>{m['eventInvitationsAdmin.deleteTokenUses']()}</strong>
					{m['eventInvitationsAdmin.deleteTokenUsesText']({ count: tokenToDelete.uses ?? 0 })}
				</p>
				<p class="text-muted-foreground">
					{m['eventInvitationsAdmin.deleteTokenWarning']()}
				</p>
			</div>
		{/if}

		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => (tokenToDelete = null)}
				disabled={deleteTokenMutation.isPending}
			>
				{m['eventInvitationsAdmin.cancel']()}
			</Button>
			<Button
				variant="destructive"
				onclick={handleDeleteToken}
				disabled={deleteTokenMutation.isPending}
			>
				{#if deleteTokenMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['eventInvitationsAdmin.deleteTokenButton']()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Share Token Dialog -->
{#if tokenToShare}
	<TokenShareDialog
		open={!!tokenToShare}
		{shareUrl}
		tokenName={tokenToShare.name || undefined}
		onClose={() => (tokenToShare = null)}
	/>
{/if}
