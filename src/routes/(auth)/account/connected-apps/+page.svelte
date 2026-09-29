<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Loader2, Plug } from '@lucide/svelte';
	import type { OAuthConnectionSchema } from '$lib/api/generated/types.gen';
	import {
		connectionsQuery,
		oauthKeys,
		revokeConnection,
		scopesQuery
	} from '$lib/api/queries/oauth';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import ConnectionCard from '$lib/components/oauth/ConnectionCard.svelte';

	const queryClient = useQueryClient();

	const connections = createQuery(() => connectionsQuery());
	const vocabulary = createQuery(() => scopesQuery());

	// Gate on `isPending` (not the token): see the memberships page for why a
	// null token cannot tell a guest from a member mid-bootstrap.
	const isPending = $derived.by(() => {
		const a = connections.isPending;
		const b = vocabulary.isPending;
		return a || b;
	});
	// Either half failing means the list cannot be trusted: cards without
	// labels would read as apps holding nothing. One error line, no cards.
	const isFailed = $derived.by(() => {
		const a = connections.isError;
		const b = vocabulary.isError;
		return a || b;
	});
	const rows = $derived(connections.data ?? []);
	const vocab = $derived(vocabulary.data ?? []);

	let pending = $state<OAuthConnectionSchema | null>(null);

	const removal = createMutation(() => ({
		...revokeConnection(),
		onSuccess: async (_data, clientId) => {
			const name = rows.find((row) => row.client_id === clientId)?.application.name ?? '';
			await queryClient.invalidateQueries({ queryKey: oauthKeys.connections });
			toast.success(m['oauth.connections.removed']({ name }));
		},
		onError: () => {
			toast.error(m['oauth.connections.removeError']());
		},
		onSettled: () => {
			pending = null;
		}
	}));

	// ConfirmDialog does not close itself on confirm: it stays open (driven by
	// `pending`) until the request settles, so guard against a double submit.
	function confirmRemoval() {
		if (!pending || removal.isPending) return;
		removal.mutate(pending.client_id);
	}
</script>

<svelte:head>
	<title>{m['oauth.connections.title']()}</title>
</svelte:head>

<div class="container mx-auto max-w-3xl space-y-6 px-4 py-6">
	<PageHeader kicker={m['myInvoices.account']()} title={m['oauth.connections.title']()} />

	<section aria-labelledby="connected-apps-heading" class="space-y-3">
		<SectionHeader id="connected-apps-heading" title={m['oauth.connections.section']()} />

		{#if isPending}
			<div role="status">
				<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
				<span class="sr-only">{m['common.loading']()}</span>
			</div>
		{:else if isFailed}
			<p role="alert" class="text-sm text-destructive">{m['oauth.connections.loadError']()}</p>
		{:else if rows.length === 0}
			<EmptyState
				icon={Plug}
				level={3}
				title={m['oauth.connections.emptyTitle']()}
				body={m['oauth.connections.emptyBody']()}
			/>
		{:else}
			<div class="space-y-3">
				{#each rows as connection (connection.client_id)}
					<ConnectionCard
						{connection}
						vocabulary={vocab}
						removing={removal.isPending && pending?.client_id === connection.client_id}
						onRemove={(target) => (pending = target)}
					/>
				{/each}
			</div>
		{/if}

		<p class="text-sm text-muted-foreground">{m['oauth.connections.emailNote']()}</p>
	</section>
</div>

<ConfirmDialog
	isOpen={pending !== null}
	title={m['oauth.connections.confirmTitle']({ name: pending?.application.name ?? '' })}
	message={m['oauth.connections.confirmMessage']()}
	confirmText={m['oauth.connections.confirmAction']()}
	variant="danger"
	onConfirm={confirmRemoval}
	onCancel={() => (pending = null)}
/>
