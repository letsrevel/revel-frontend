<script lang="ts">
	import type { PageData } from './$types';
	import { SeoHead } from '$lib/seo';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { page } from '$app/stores';
	import OrgPage from './org/[slug]/+page.svelte';
	import { FeeCalculatorModal } from '$lib/components/landing';
	import {
		HeroPanel,
		FilmPanel,
		PricingPanel,
		CommunitiesPanel,
		VenuesPanel,
		ClubsPanel,
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

{#if data.kind === 'org'}
	<!-- Tenant host (#1056): the organization's page lives at the root URL. -->
	<OrgPage {data} />
{:else}
	<SeoHead config={data.seo} />

	<HeroPanel {isAuthenticated} demoBookingUrl={data.demoBookingUrl} />
	<FilmPanel />
	<PricingPanel onOpenCalculator={() => (showFeeCalculator = true)} feeConfig={data.feeConfig} />
	<VenuesPanel />
	<ClubsPanel />
	<CommunitiesPanel />
	<FeaturesPanel {landingPagePrefix} />
	<OpenSourcePanel />
	<ClosePanel {canCreateOrg} demoBookingUrl={data.demoBookingUrl} />

	<FeeCalculatorModal bind:open={showFeeCalculator} feeConfig={data.feeConfig} />
{/if}
