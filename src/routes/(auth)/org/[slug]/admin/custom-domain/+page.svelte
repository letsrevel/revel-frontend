<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import CustomDomainManager from '$lib/components/organization/custom-domain/CustomDomainManager.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	const { data }: Props = $props();
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

	<CustomDomainManager slug={data.organization.slug} />
</div>
