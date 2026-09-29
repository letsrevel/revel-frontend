<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Loader2 } from '@lucide/svelte';
	import { createApp, isEmailUnverified, oauthKeys, scopesQuery } from '$lib/api/queries/oauth';
	import { authStore } from '$lib/stores/auth.svelte';
	import { fieldErrorsFrom, type AppFormValues } from '$lib/utils/oauth-app-form';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import DeveloperAppForm from '$lib/components/oauth/DeveloperAppForm.svelte';
	import SecretReveal from '$lib/components/oauth/SecretReveal.svelte';
	import EmailUnverifiedCallout from '$lib/components/oauth/EmailUnverifiedCallout.svelte';

	const queryClient = useQueryClient();

	// Only an explicit `false` short-circuits: a user still loading is not unverified.
	const storeUnverified = $derived(authStore.user?.email_verified === false);

	const scopes = createQuery(() => ({ ...scopesQuery(), enabled: !storeUnverified }));

	/** The one-time secret lives here only; never in a query or mutation cache. */
	let secret = $state<{ clientId: string; clientSecret: string; appId: string } | null>(null);
	let fieldErrors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let revealEl = $state<HTMLDivElement | null>(null);

	/** The form unmounts under the user's focus: land them on the reveal's heading. */
	async function focusReveal() {
		await tick();
		const heading = revealEl?.querySelector<HTMLElement>('h2');
		heading?.setAttribute('tabindex', '-1');
		heading?.focus();
	}

	const mutation = createMutation(() => ({
		...createApp(),
		onMutate: () => {
			fieldErrors = {};
			formError = null;
		},
		onSuccess: async (created) => {
			if (created.client_secret) {
				// Capture the secret before any await, so an unmount mid-refresh cannot lose it.
				secret = {
					clientId: created.client_id,
					clientSecret: created.client_secret,
					appId: created.id
				};
				// Detach the observer: the settled mutation's `data` carries the secret, and
				// with no observer left `gcTime: 0` drops it from the mutation cache.
				mutation.reset();
				await queryClient.invalidateQueries({ queryKey: oauthKeys.apps });
				await focusReveal();
			} else {
				await queryClient.invalidateQueries({ queryKey: oauthKeys.apps });
				toast.success(m['oauth.developer.created']({ name: created.name }));
				await goto(resolve('/(auth)/account/developer-apps/[app_id]', { app_id: created.id }));
			}
		},
		onError: (err) => {
			({ fields: fieldErrors, form: formError } = fieldErrorsFrom(err));
		}
	}));

	// The backend 403s the whole surface for an unverified email; the store may lag behind.
	const unverified = $derived(
		storeUnverified || isEmailUnverified(scopes.error) || isEmailUnverified(mutation.error)
	);

	function submit(values: AppFormValues) {
		mutation.mutate({ ...values });
	}

	function done() {
		if (secret)
			void goto(resolve('/(auth)/account/developer-apps/[app_id]', { app_id: secret.appId }));
	}
</script>

<svelte:head>
	<title>{m['oauth.developer.createTitle']()}</title>
</svelte:head>

<div class="container mx-auto max-w-3xl space-y-6 px-4 py-6">
	<PageHeader kicker={m['myInvoices.account']()} title={m['oauth.developer.createTitle']()} />

	{#if unverified}
		<EmailUnverifiedCallout />
	{:else if secret}
		<div bind:this={revealEl} class="[&_h2]:outline-none">
			<SecretReveal clientId={secret.clientId} clientSecret={secret.clientSecret} onDone={done} />
		</div>
	{:else if scopes.isPending}
		<div role="status">
			<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
			<span class="sr-only">{m['common.loading']()}</span>
		</div>
	{:else if scopes.isError}
		<p role="alert" class="text-sm text-destructive">{m['oauth.developer.actionError']()}</p>
	{:else}
		<DeveloperAppForm
			mode="create"
			vocabulary={scopes.data}
			submitting={mutation.isPending}
			{formError}
			{fieldErrors}
			onSubmit={submit}
		/>
	{/if}
</div>
