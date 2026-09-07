<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { Check, AlertCircle, Plug } from '@lucide/svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ProviderCard from '$lib/components/organization/integrations/ProviderCard.svelte';
	import {
		landingOutcome,
		LANDING_PARAMS,
		type LandingOutcome
	} from '$lib/components/organization/integrations/connection-view';
	import { integrationErrorMessage } from '$lib/utils/integration-errors';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	const { data }: Props = $props();

	const SELF_HOSTING_DOCS = 'https://docs.letsrevel.io/self-hosting/';

	let landing = $state<LandingOutcome>(null);

	// The OAuth callback lands here with one query key. Read it once, then strip
	// it (Stripe Connect does the same) so a reload does not replay the strip.
	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		landing = landingOutcome(params);
		if (landing) {
			const landingKeys: readonly string[] = LANDING_PARAMS;
			const rest = new URLSearchParams(
				[...params].filter(([key]) => !landingKeys.includes(key))
			).toString();
			window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
		}
	});

	function platformFor(provider: string): string {
		return data.connections.find((c) => c.provider === provider)?.display_name ?? provider;
	}

	type StripTone = 'success' | 'info' | 'danger';

	const landingStrip = $derived.by((): { tone: StripTone; text: string } | null => {
		if (!landing) return null;
		switch (landing.kind) {
			case 'connected':
				return {
					tone: 'success',
					text: m['integrations.landing.connected']({ platform: platformFor(landing.provider) })
				};
			case 'select':
				return {
					tone: 'info',
					text: m['integrations.landing.chooseAccount']({
						platform: platformFor(landing.provider)
					})
				};
			case 'error': {
				// The error landing carries no provider; with one platform per
				// instance today, the first enabled provider's name is the right one.
				const platform = data.connections[0]?.display_name ?? '';
				return {
					tone: 'danger',
					text:
						integrationErrorMessage(landing.code, platform, 'landing') ??
						m['integrations.error.generic']({ platform })
				};
			}
		}
	});

	// Background + border tint only; the icon carries the tone, the text stays
	// on --foreground (same rule as the cards).
	const STRIP_CLASSES: Record<StripTone, string> = {
		success: 'border-success/40 bg-success/10',
		info: 'border-info/40 bg-info/10',
		danger: 'border-destructive/50 bg-destructive/10'
	};
	const STRIP_ICON: Record<StripTone, string> = {
		success: 'text-success',
		info: 'text-info',
		danger: 'text-destructive'
	};
</script>

<svelte:head>
	<title>{m['integrations.pageTitle']({ organizationName: data.organization.name })}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6 px-4 md:px-0">
	<PageHeader
		title={m['integrations.title']()}
		subtitle={m['integrations.subtitle']()}
		volume="studio"
	/>

	{#if landingStrip}
		<div
			class="flex items-start gap-2 rounded-lg border p-4 {STRIP_CLASSES[landingStrip.tone]}"
			role="alert"
		>
			{#if landingStrip.tone === 'success'}
				<Check class="mt-0.5 h-5 w-5 shrink-0 {STRIP_ICON.success}" aria-hidden="true" />
			{:else}
				<AlertCircle
					class="mt-0.5 h-5 w-5 shrink-0 {STRIP_ICON[landingStrip.tone]}"
					aria-hidden="true"
				/>
			{/if}
			<p class="text-sm text-foreground">{landingStrip.text}</p>
		</div>
	{/if}

	{#if data.connections.length === 0}
		<EmptyState
			icon={Plug}
			title={m['integrations.empty.title']()}
			body={m['integrations.empty.body']()}
			level={2}
		>
			{#snippet action()}
				<a
					href={SELF_HOSTING_DOCS}
					target="_blank"
					rel="noopener noreferrer"
					class="text-sm font-medium text-primary underline-offset-4 hover:underline"
				>
					{m['integrations.empty.docsLink']()}
				</a>
			{/snippet}
		</EmptyState>
	{:else}
		{#each data.connections as connection (connection.provider)}
			<ProviderCard
				organizationSlug={data.organization.slug}
				{connection}
				onChanged={() => invalidateAll()}
			/>
		{/each}
	{/if}
</div>
