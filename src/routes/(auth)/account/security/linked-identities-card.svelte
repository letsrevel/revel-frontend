<script lang="ts">
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { accountListIdentities, accountUnlinkIdentity } from '$lib/api/client';
	import type { ExternalIdentitySchema } from '$lib/api/generated/types.gen';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { formatDate } from '$lib/utils/date';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { KeyRound, Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		authToken: string;
	}

	const { authToken }: Props = $props();

	const queryClient = useQueryClient();

	const identitiesQuery = createQuery(() => ({
		queryKey: ['account-identities'],
		queryFn: async (): Promise<ExternalIdentitySchema[]> => {
			const response = await accountListIdentities({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			if (response.error || !response.data) {
				throw new Error(
					extractErrorMessage(response.error, m['accountSecurityPage.identities_loadError']())
				);
			}
			return response.data;
		}
	}));

	let confirmTarget = $state<ExternalIdentitySchema | null>(null);
	let unlinkError = $state<string | null>(null);
	// bind:open drives the dialog (mirrors account/invoices +page.svelte's
	// `bind:open={dialogOpen} onOpenChange={(open) => !open && closeDetail()}`
	// precedent). onOpenChange also fires for Escape/overlay-dismiss, so
	// clearing confirmTarget there — not in an $effect — catches those too.
	let dialogOpen = $state(false);

	function handleDialogOpenChange(open: boolean): void {
		dialogOpen = open;
		if (!open) {
			confirmTarget = null;
		}
	}

	const unlinkMutation = createMutation(() => ({
		mutationFn: async (identity: ExternalIdentitySchema) => {
			const response = await accountUnlinkIdentity({
				path: { provider: identity.provider },
				headers: { Authorization: `Bearer ${authToken}` }
			});
			if (response.error) {
				throw new Error(extractErrorMessage(response.error));
			}
			return identity;
		},
		onSuccess: (identity) => {
			unlinkError = null;
			queryClient.invalidateQueries({ queryKey: ['account-identities'] });
			toast.success(
				m['accountSecurityPage.identities_unlinkSuccess']({ provider: identity.provider_name })
			);
		},
		onError: (error: Error) => {
			unlinkError = error.message;
		}
	}));

	function requestUnlink(identity: ExternalIdentitySchema): void {
		unlinkError = null;
		confirmTarget = identity;
		dialogOpen = true;
	}

	function confirmUnlink(): void {
		if (confirmTarget) {
			unlinkMutation.mutate(confirmTarget);
		}
		handleDialogOpenChange(false);
	}

	function cancelUnlink(): void {
		handleDialogOpenChange(false);
	}
</script>

<div class="mt-6 rounded-lg border bg-card p-6">
	<div class="flex items-center gap-2">
		<KeyRound class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
		<SectionHeader title={m['accountSecurityPage.identities_title']()} class="flex-1" />
	</div>
	<p class="mb-6 mt-2 text-sm text-muted-foreground">
		{m['accountSecurityPage.identities_description']()}
	</p>

	{#if unlinkError}
		<div role="alert" class="mb-4 rounded-md border border-destructive bg-destructive/10 p-3">
			<p class="text-sm font-medium text-destructive">{unlinkError}</p>
		</div>
	{/if}

	{#if identitiesQuery.isPending}
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			<span class="sr-only">{m['accountSecurityPage.identities_title']()}</span>
		</div>
	{:else if identitiesQuery.isError}
		<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-3">
			<p class="text-sm font-medium text-destructive">
				{(identitiesQuery.error as Error).message}
			</p>
		</div>
	{:else if identitiesQuery.data && identitiesQuery.data.length > 0}
		<ul class="divide-y divide-border">
			{#each identitiesQuery.data as identity (identity.provider)}
				<li class="flex flex-wrap items-center justify-between gap-3 py-3">
					<div class="min-w-0">
						<p class="font-bold">{identity.provider_name}</p>
						<p class="truncate text-sm text-muted-foreground">{identity.email}</p>
						<p class="text-xs text-muted-foreground">
							{m['accountSecurityPage.identities_linkedOn']({
								date: formatDate(identity.created_at)
							})}
						</p>
					</div>
					<button
						type="button"
						onclick={() => requestUnlink(identity)}
						disabled={unlinkMutation.isPending}
						aria-label={m['accountSecurityPage.identities_unlinkAria']({
							provider: identity.provider_name
						})}
						class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{m['accountSecurityPage.identities_unlink']()}
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-muted-foreground">{m['accountSecurityPage.identities_empty']()}</p>
	{/if}
</div>

<Dialog.Root bind:open={dialogOpen} onOpenChange={handleDialogOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>
				{m['accountSecurityPage.identities_unlinkDialogTitle']({
					provider: confirmTarget?.provider_name ?? ''
				})}
			</Dialog.Title>
			<Dialog.Description>
				{m['accountSecurityPage.identities_unlinkDialogDescription']({
					provider: confirmTarget?.provider_name ?? ''
				})}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<button
				type="button"
				onclick={cancelUnlink}
				class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				{m['accountSecurityPage.identities_unlinkCancel']()}
			</button>
			<button
				type="button"
				onclick={confirmUnlink}
				class="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
			>
				{m['accountSecurityPage.identities_unlinkConfirm']()}
			</button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
