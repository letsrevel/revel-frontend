<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { CodeXml, Loader2, Plus } from '@lucide/svelte';
	import { appsQuery, isEmailUnverified } from '$lib/api/queries/oauth';
	import { authStore } from '$lib/stores/auth.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';
	import DeveloperAppCard from '$lib/components/oauth/DeveloperAppCard.svelte';
	import EmailUnverifiedCallout from '$lib/components/oauth/EmailUnverifiedCallout.svelte';

	const user = $derived(authStore.user);
	// Only an explicit `false` short-circuits: a user still loading is not unverified.
	const storeUnverified = $derived(user?.email_verified === false);

	const apps = createQuery(() => ({ ...appsQuery(), enabled: !storeUnverified }));

	// The backend 403s the whole surface for an unverified email; the store may
	// lag behind (verified elsewhere, or not loaded yet), so honour both.
	const unverified = $derived(storeUnverified || isEmailUnverified(apps.error));
	const rows = $derived(apps.data ?? []);
	const newAppHref = resolve('/(auth)/account/developer-apps/new', {});
</script>

{#snippet newAppAction()}
	<Button href={newAppHref}>
		<Plus class="h-4 w-4" aria-hidden="true" />
		{m['oauth.developer.newApp']()}
	</Button>
{/snippet}

<svelte:head>
	<title>{m['oauth.developer.title']()}</title>
</svelte:head>

<div class="container mx-auto max-w-3xl space-y-6 px-4 py-6">
	<!-- No "New app" action while unverified: the create route 403s too. -->
	<PageHeader
		kicker={m['myInvoices.account']()}
		title={m['oauth.developer.title']()}
		actions={unverified ? undefined : newAppAction}
	/>

	{#if unverified}
		<EmailUnverifiedCallout />
	{:else}
		<section aria-labelledby="developer-apps-heading" class="space-y-3">
			<SectionHeader id="developer-apps-heading" title={m['oauth.developer.section']()} />

			{#if apps.isPending}
				<div role="status">
					<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
					<span class="sr-only">{m['common.loading']()}</span>
				</div>
			{:else if apps.isError}
				<p role="alert" class="text-sm text-destructive">{m['oauth.developer.loadError']()}</p>
			{:else if rows.length === 0}
				<EmptyState
					icon={CodeXml}
					level={3}
					title={m['oauth.developer.emptyTitle']()}
					body={m['oauth.developer.emptyBody']()}
				>
					{#snippet action()}
						<Button href={newAppHref} variant="outline">{m['oauth.developer.newApp']()}</Button>
					{/snippet}
				</EmptyState>
			{:else}
				<div class="space-y-3">
					{#each rows as app (app.id)}
						<DeveloperAppCard {app} />
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>
