<script lang="ts">
	import type { PageData } from './$types';
	import { SeoHead } from '$lib/seo';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { page } from '$app/stores';
	import { FeeCalculatorModal } from '$lib/components/landing';
	import {
		HeroPanel,
		PricingPanel,
		CommunitiesPanel,
		VenuesPanel,
		FeaturesPanel,
		OpenSourcePanel,
		ClosePanel
	} from '$lib/components/landing/poster';

	interface Props {
		data: PageData;
	}
	const { data }: Props = $props();

	let showFeeCalculator = $state(false);

	const isAuthenticated = $derived(authStore.isAuthenticated);
	const canCreateOrg = $derived(Boolean($page.data.features?.organization_creation));
	// Landing pages are NOT paraglide-translated; they use /de/ and /it/ prefixes.
	const landingPagePrefix = $derived(getLocale() === 'en' ? '' : `/${getLocale()}`);
</script>

<SeoHead config={data.seo} />

<HeroPanel {isAuthenticated} />
<PricingPanel onOpenCalculator={() => (showFeeCalculator = true)} />
<VenuesPanel />
<CommunitiesPanel />
<FeaturesPanel {landingPagePrefix} />
<OpenSourcePanel />
<ClosePanel {canCreateOrg} />

<FeeCalculatorModal bind:open={showFeeCalculator} />
