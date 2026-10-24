<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Globe, Mail } from '@lucide/svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';
	import CustomDomainManager from '$lib/components/organization/custom-domain/CustomDomainManager.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	const { data }: Props = $props();

	const requestHref = $derived(
		data.supportEmail
			? `mailto:${data.supportEmail}?subject=${encodeURIComponent(
					m['customDomain.unavailable.emailSubject']({ organizationName: data.organization.name })
				)}`
			: null
	);
</script>

<svelte:head>
	<title>{m['customDomain.pageTitle']({ organizationName: data.organization.name })}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6 px-4 md:px-0">
	<PageHeader
		title={m['customDomain.title']()}
		subtitle={m['customDomain.subtitle']()}
		volume="studio"
	/>

	{#if data.customDomainEnabled}
		<CustomDomainManager slug={data.organization.slug} />
	{:else}
		{#snippet requestAction()}
			{#if requestHref && data.supportEmail}
				<Button href={requestHref} variant="outline">
					<Mail aria-hidden="true" />
					{m['customDomain.unavailable.contact']({ email: data.supportEmail })}
				</Button>
			{/if}
		{/snippet}
		<EmptyState
			icon={Globe}
			level={2}
			title={m['customDomain.unavailable.heading']()}
			body={data.supportEmail
				? m['customDomain.unavailable.body']()
				: m['customDomain.unavailable.bodyNoEmail']()}
			action={requestAction}
		/>
	{/if}
</div>
