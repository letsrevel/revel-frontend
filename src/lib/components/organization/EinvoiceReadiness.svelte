<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertTriangle, Info } from '@lucide/svelte';
	import { missingFieldLabels, type MissingFieldContext } from '$lib/utils/einvoice';

	interface Props {
		/** Raw `einvoice_missing_fields` values from the billing-info GET. */
		missingFields: readonly string[];
		/**
		 * `warning`: invoicing is on, so the gaps matter now.
		 * `info`: invoicing is off; a gentler heads-up before it is turned on.
		 */
		variant: 'warning' | 'info';
		id?: string;
		/** Country of establishment and declared scheme: they change what a VAT ID is worth. */
		context?: MissingFieldContext;
	}

	const { missingFields, variant, id, context }: Props = $props();

	const labels = $derived(missingFieldLabels(missingFields, context));
</script>

{#if labels.length > 0}
	{#if variant === 'warning'}
		<div
			{id}
			class="flex items-start gap-3 rounded-lg border border-highlight/40 bg-highlight/20 p-4"
			role="status"
			data-testid="einvoice-readiness-warning"
		>
			<AlertTriangle
				class="mt-0.5 h-5 w-5 shrink-0 text-highlight-foreground dark:text-highlight"
				aria-hidden="true"
			/>
			<div class="space-y-1 text-sm">
				<p class="font-semibold">{m['einvoice.nagTitle']()}</p>
				<p>{m['einvoice.nagIntro']()}</p>
				<ul class="list-disc space-y-0.5 pl-5">
					{#each labels as label (label)}
						<li>{label}</li>
					{/each}
				</ul>
			</div>
		</div>
	{:else}
		<p
			{id}
			class="flex items-start gap-2 text-sm text-muted-foreground"
			data-testid="einvoice-readiness-info"
		>
			<Info class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
			<span>{m['einvoice.nagModeNone']({ fields: labels.join(', ') })}</span>
		</p>
	{/if}
{/if}
