<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation } from '@tanstack/svelte-query';
	import { AlertCircle, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import {
		organizationintegrationsAccounts,
		organizationintegrationsSelectAccount
	} from '$lib/api/generated/sdk.gen';
	import {
		integrationErrorFromResponse,
		isIntegrationErrorInfo,
		silentIntegrationError,
		type IntegrationErrorInfo
	} from '$lib/utils/integration-errors';

	interface Props {
		organizationSlug: string;
		provider: string;
		/** `display_name` from the API; every line of copy names it. */
		platform: string;
		onSelected: () => void;
	}
	const { organizationSlug, provider, platform, onSelected }: Props = $props();

	let selected = $state<string | null>(null);
	let submitError = $state<IntegrationErrorInfo | null>(null);

	// Only valid while the connection is `pending`; the backend answers 409
	// `connection_pending` otherwise, which lands in `loadError` below.
	const accounts = createQuery(() => ({
		queryKey: ['org-integration-accounts', organizationSlug, provider],
		queryFn: async () => {
			const res = await organizationintegrationsAccounts({
				path: { slug: organizationSlug, provider }
			});
			if (res.error || !res.data) throw integrationErrorFromResponse(res.error, platform);
			return res.data;
		}
	}));

	const select = createMutation(() => ({
		mutationFn: async (remote_id: string) => {
			const res = await organizationintegrationsSelectAccount({
				path: { slug: organizationSlug, provider },
				body: { remote_id }
			});
			if (res.error || !res.data) throw silentIntegrationError(res.error, platform);
			return res.data;
		},
		onSuccess: () => onSelected(),
		onError: (err: unknown) => {
			submitError = isIntegrationErrorInfo(err)
				? err
				: integrationErrorFromResponse(err, platform);
		}
	}));

	const loadError = $derived(isIntegrationErrorInfo(accounts.error) ? accounts.error : null);

	function inputId(remoteId: string): string {
		return `account-${provider}-${remoteId}`;
	}
</script>

<div class="space-y-3">
	<p class="text-sm text-muted-foreground">{m['integrations.card.pending.body']({ platform })}</p>

	{#if accounts.isPending}
		<p class="flex items-center gap-2 text-sm text-muted-foreground" role="status">
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			{m['integrations.card.pending.loading']({ platform })}
		</p>
	{:else if loadError}
		<div
			class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3"
			role="alert"
		>
			<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
			<p class="text-sm text-foreground">{loadError.message}</p>
		</div>
	{:else if accounts.data && accounts.data.length === 0}
		<p class="text-sm text-foreground">{m['integrations.card.pending.none']({ platform })}</p>
	{:else if accounts.data}
		<RadioGroup.Root
			value={selected ?? ''}
			onValueChange={(value) => {
				if (value) selected = value;
			}}
		>
			<div class="space-y-2">
				{#each accounts.data as account (account.remote_id)}
					<div class="flex items-center gap-3">
						<RadioGroup.Item value={account.remote_id} id={inputId(account.remote_id)} />
						<Label for={inputId(account.remote_id)} class="font-medium">{account.name}</Label>
					</div>
				{/each}
			</div>
		</RadioGroup.Root>

		{#if submitError}
			<div
				class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3"
				role="alert"
			>
				<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
				<p class="text-sm text-foreground">{submitError.message}</p>
			</div>
		{/if}

		<Button
			disabled={!selected || select.isPending}
			onclick={() => {
				if (selected) select.mutate(selected);
			}}
			class="inline-flex items-center gap-2"
		>
			{#if select.isPending}
				<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{m['integrations.card.pending.saving']()}
			{:else}
				{m['integrations.card.pending.useAccount']()}
			{/if}
		</Button>
	{/if}
</div>
