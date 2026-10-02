<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OrganizationComplianceSchema } from '$lib/api/generated/types.gen';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import { ExternalLink, Globe } from '@lucide/svelte';
	import ComplianceNotices from './ComplianceNotices.svelte';
	import {
		complianceDocsUrl,
		countryName,
		isEuCountry,
		restrictionBullets
	} from '$lib/utils/compliance';

	/**
	 * Org settings → Billing: "Country rules" (#1001). Read-only summary of the
	 * org-level `compliance` object; the country is never editable here (it is
	 * derived from the VAT country / VAT ID / city).
	 */
	interface Props {
		compliance: OrganizationComplianceSchema;
	}

	const { compliance }: Props = $props();

	const country = $derived(countryName(compliance.country));
	const bullets = $derived(restrictionBullets(compliance));
	const scope = $derived(
		!compliance.country ? 'unknown' : isEuCountry(compliance.country) ? 'eu' : 'non-eu'
	);
</script>

<section
	class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
	data-testid="country-rules-card"
	data-country={compliance.country}
>
	<div class="flex items-center gap-2">
		<Globe class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
		<SectionHeader id="country-rules-title" title={m['compliance.card.title']()} class="flex-1" />
	</div>

	<div class="space-y-2 text-sm">
		{#if scope === 'unknown'}
			<p>{m['compliance.card.bodyUnknown']()}</p>
		{:else if scope === 'non-eu'}
			<p>{m['compliance.card.bodyOutOfScope']()}</p>
		{:else if bullets.length > 0}
			<p>{m['compliance.card.bodyRestricted']({ country })}</p>
			<ul class="list-disc space-y-1 pl-5" data-testid="country-rules-restrictions">
				{#each bullets as bullet (bullet)}
					<li>{bullet}</li>
				{/each}
			</ul>
		{:else}
			<p>{m['compliance.card.bodyAllowed']({ country })}</p>
		{/if}
	</div>

	{#if compliance.notices.length > 0}
		<div class="space-y-2">
			<h3 class="text-sm font-bold">{m['compliance.card.noticesTitle']()}</h3>
			<!-- Every org notice shows here, whatever its `applies_to`: the card is
			     also the home for topics this UI doesn't place anywhere else. -->
			<ComplianceNotices notices={compliance.notices} />
		</div>
	{/if}

	<p class="text-xs text-muted-foreground">
		{m['compliance.card.footnote']()}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- external docs URL, not an app route -->
		<a
			href={complianceDocsUrl(compliance.country)}
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
		>
			{m['compliance.card.learnMore']()}
			<span class="sr-only">{m['compliance.card.opensInNewTab']()}</span>
			<ExternalLink class="h-3 w-3" aria-hidden="true" />
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</p>
</section>
