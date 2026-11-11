<script lang="ts">
	import GlobalEmailSuppressionBanner from '$lib/components/notifications/GlobalEmailSuppressionBanner.svelte';
	import Header from './Header.svelte';
	import Footer from './Footer.svelte';
	import TenantHeader from '$lib/components/tenant/TenantHeader.svelte';
	import TenantFooter from '$lib/components/tenant/TenantFooter.svelte';
	import { page } from '$app/stores';

	interface Props {
		children?: import('svelte').Snippet;
	}

	const { children }: Props = $props();

	// On an organization's custom domain, swap in the tenant chrome (#1056).
	const tenant = $derived($page.data.tenant ?? null);

	// The org admin layout renders a sidebar inside <main>, so the skip link must
	// land on its content column instead. That column owns `id="main-content"` on
	// admin routes (see admin/+layout.svelte); exactly one element may carry it.
	const adminOwnsSkipTarget = $derived(
		($page.route?.id ?? '').startsWith('/(auth)/org/[slug]/admin')
	);
</script>

<div class="flex min-h-screen flex-col">
	{#if tenant}
		<TenantHeader {tenant} />
	{:else}
		<Header />
	{/if}
	<GlobalEmailSuppressionBanner />

	<main id={adminOwnsSkipTarget ? undefined : 'main-content'} class="flex-1">
		{@render children?.()}
	</main>

	{#if tenant}
		<TenantFooter {tenant} platformOrigin={$page.data.customDomains?.platformOrigin ?? null} />
	{:else}
		<Footer />
	{/if}
</div>
