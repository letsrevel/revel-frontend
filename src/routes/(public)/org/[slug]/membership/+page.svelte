<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';
	import MembershipSection from '$lib/components/organization/membership/MembershipSection.svelte';
	import { SeoHead } from '$lib/seo';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	const organization = $derived(data.organization);
</script>

<SeoHead config={data.seo} />

<div class="space-y-6">
	<a
		href={resolve('/(public)/org/[slug]', { slug: organization.slug })}
		class="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
	>
		<ArrowLeft class="h-4 w-4" aria-hidden="true" />
		{m['membershipTiers.backToOrg']({ organizationName: organization.name })}
	</a>

	<MembershipSection
		{organization}
		tiers={data.tiers}
		isAuthenticated={data.isAuthenticated}
		isMember={data.isMember}
		membershipTier={data.membershipTier}
		membershipStatus={data.membershipStatus}
		isOwner={data.isOwner}
		isStaff={data.isStaff}
	/>
</div>
