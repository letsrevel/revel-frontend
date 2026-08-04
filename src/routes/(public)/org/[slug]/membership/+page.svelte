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

<!--
	Tinted page panel (uplift, spec §9) — the org profile's wash, so following
	"View membership" from that page lands on the same surface rather than
	dropping back onto bare paper. Full-bleed with `min-h-screen`, so a short
	tier list cannot leave a `--background` strip underneath. Composite and
	therefore ratios are identical to the profile's (a composited alpha is
	invisible to scripts/audit-brand-themes.py):
	  light — secondary@55 over background ⇒ hsl(231 88% 90%);
	          foreground 12.42:1 · muted-foreground 6.45:1 · primary 4.97:1
	  dark  — secondary@28 over background ⇒ hsl(246 33% 15%);
	          foreground 15.75:1 · muted-foreground 7.47:1 · primary 6.30:1
	The back link (`muted-foreground`) is the only copy that lands directly on
	it; everything else is inside the header block or a tier card.
-->
<div class="min-h-screen bg-secondary/55 dark:bg-secondary/[0.28]">
	<!-- The `(public)` layout does NOT wrap its children, so every page supplies its
	     own container; without one the content runs edge to edge. Same values as the
	     org landing page this is a sub-page of, so navigating between them does not
	     shift the gutters. -->
	<div class="container mx-auto space-y-6 px-6 py-8 md:px-8 lg:py-12">
		<a
			href={resolve('/(public)/org/[slug]', { slug: organization.slug })}
			class="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
</div>
