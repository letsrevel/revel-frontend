<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import AdminWarningList from '$lib/components/admin-warnings/AdminWarningList.svelte';
	import { orgCustomDomainWhileRestricted } from '$lib/utils/admin-warnings/org';
	import { compactWarnings, withLink } from '$lib/utils/admin-warnings/types';
	import { Globe, Mail } from '@lucide/svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Button } from '$lib/components/ui/button';
	import CustomDomainManager from '$lib/components/organization/custom-domain/CustomDomainManager.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { customDomainQueryKey } from '$lib/components/organization/custom-domain/query-key';
	import { getCustomDomain } from '$lib/components/organization/custom-domain/custom-domain-api';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	const { data }: Props = $props();

	// The manager below removes and activates domains and only updates this query,
	// so A5 reads the same query (shared cache). The layout snapshot is the fallback
	// until the query has data, and when the feature is off.
	const domainQuery = createQuery(() => ({
		queryKey: customDomainQueryKey(data.organization.slug),
		queryFn: () => getCustomDomain(data.organization.slug),
		enabled: data.customDomainEnabled
	}));
	const activeHostname = $derived(
		domainQuery.data === undefined
			? data.organization.custom_domain
			: domainQuery.data?.status === 'active'
				? domainQuery.data.hostname
				: null
	);

	// A5 (#1314): same rule and dismissal (entity = org id) as the settings page.
	const warnings = $derived.by(() => {
		const a5 = orgCustomDomainWhileRestricted({
			orgVisibility: data.organization.visibility,
			custom_domain: activeHostname
		});
		return compactWarnings([
			a5 &&
				withLink(
					a5,
					`${resolve('/(auth)/org/[slug]/admin/settings', { slug: data.organization.slug })}#visibility`,
					() => m['adminWarnings.fixVisibility']()
				)
		]);
	});

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
		volume="studio"
		kicker={data.organization.name}
		title={m['customDomain.title']()}
		subtitle={m['customDomain.subtitle']()}
		titleAttrs={{ id: 'custom-domain-title', tabindex: -1 }}
	/>

	<AdminWarningList
		{warnings}
		fallbackFocusId="custom-domain-title"
		entityId={data.organization.id}
		label={m['adminWarnings.listLabelNamed']({ name: m['customDomain.title']() })}
		testId="custom-domain-warnings"
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
