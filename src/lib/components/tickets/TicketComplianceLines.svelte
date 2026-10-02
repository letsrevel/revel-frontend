<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { TicketComplianceLineSchema } from '$lib/api/generated/types.gen';

	/**
	 * The lines the ticket PDF and wallet passes print (#1001, backend #1077):
	 * organizer, tax ID, ticket number, issue time, price, notice, plus country
	 * additions such as `it_reservation`. `label`/`value` arrive translated and
	 * ordered; render them generically and keyed on `key`, so an unknown key
	 * still shows. Sentence-style lines (`notice`, `it_reservation`, …) span the
	 * full width so they never truncate.
	 */
	interface Props {
		lines: TicketComplianceLineSchema[];
	}

	const { lines }: Props = $props();
	const uid = $props.id();

	// Short label/value facts sit in a two-column grid; everything else is a
	// sentence and gets the full row.
	const FACT_KEYS: ReadonlySet<string> = new Set([
		'organizer',
		'tax_id',
		'ticket_number',
		'issued_at',
		'price'
	]);
</script>

{#if lines.length > 0}
	<section aria-labelledby="{uid}-title" class="space-y-2">
		<h3 id="{uid}-title" class="text-sm font-bold">
			{m['compliance.ticket.linesTitle']()}
		</h3>
		<dl
			class="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2"
			data-testid="ticket-compliance-lines"
		>
			{#each lines as line, i (`${line.key}-${i}`)}
				<div
					class={FACT_KEYS.has(line.key) ? 'min-w-0' : 'min-w-0 sm:col-span-2'}
					data-key={line.key}
				>
					<dt class="text-xs text-muted-foreground">{line.label}</dt>
					<dd class="break-words font-medium">{line.value}</dd>
				</div>
			{/each}
		</dl>
	</section>
{/if}
