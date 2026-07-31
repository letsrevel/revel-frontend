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

<!-- The `(public)` layout does NOT wrap its children, so every page supplies its
     own container; without one the content runs edge to edge. Same values as the
     org landing page this is a sub-page of, so navigating between them does not
     shift the gutters. -->
<div class="container mx-auto space-y-6 px-6 py-8 md:px-8 lg:py-12">
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
