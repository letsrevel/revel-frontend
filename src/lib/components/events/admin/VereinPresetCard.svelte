<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { Users } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import ToneTile from '$lib/components/common/ToneTile.svelte';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
	import VereinPresetDialog from './VereinPresetDialog.svelte';
	import type { OrgVatContext } from './tier-vat';
	import type { TicketCurrency } from './verein-preset';

	interface Props {
		eventId: string;
		organizationId: string;
		organizationSlug: string;
		dayTiers: MembershipTierSchema[];
		currency: TicketCurrency;
		canChargeOnline: boolean;
		orgVat?: OrgVatContext | null;
	}

	const { organizationSlug, ...rest }: Props = $props();

	let open = $state(false);
	const headingId = $props.id();
</script>

<section
	class="rounded-lg border border-border bg-card p-4"
	aria-labelledby={headingId}
	data-testid="verein-preset-card"
>
	<div class="flex items-start gap-3">
		<ToneTile tone="brand" icon={Users} class="shrink-0" />
		<div class="min-w-0 flex-1 space-y-2">
			<h3 id={headingId} class="font-bold">{m['verein.preset.card.title']()}</h3>
			<p class="text-sm text-muted-foreground">{m['verein.preset.card.body']()}</p>
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Button type="button" variant="outline" onclick={() => (open = true)}>
					{m['verein.preset.card.button']()}
				</Button>
				<a
					class="inline-flex min-h-[44px] items-center text-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					href={resolve('/(auth)/org/[slug]/admin/guides/verein-day-membership', {
						slug: organizationSlug
					})}
					target="_blank"
					rel="noopener"
				>
					{m['verein.preset.card.guide']()}
				</a>
			</div>
		</div>
	</div>
</section>

<VereinPresetDialog bind:open {organizationSlug} {...rest} />
