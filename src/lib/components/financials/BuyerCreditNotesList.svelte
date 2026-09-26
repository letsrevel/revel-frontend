<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Download, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import type { AttendeeInvoiceCreditNoteSchema } from '$lib/api/generated/types.gen';
	import { formatMoney } from '$lib/utils/format';
	import { formatDate } from '$lib/utils/date';

	interface Props {
		creditNotes: AttendeeInvoiceCreditNoteSchema[];
		currency: string;
		/** Id of the credit note whose PDF is being fetched, if any. */
		downloadingId: string | null;
		onDownload: (creditNoteId: string) => void;
	}

	const { creditNotes, currency, downloadingId, onDownload }: Props = $props();
</script>

<!-- A buyer's credit notes on one invoice (#961): each refund issues its own
     note, so list them all with a PDF download each. -->
<section aria-labelledby="buyer-credit-notes-heading">
	<h3 id="buyer-credit-notes-heading" class="mb-2 text-sm font-medium">
		{m['myInvoices.creditNotes']()}
	</h3>
	<ul class="divide-y rounded-lg border" data-testid="buyer-credit-notes">
		{#each creditNotes as note (note.id)}
			<li class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
				<div class="min-w-0">
					<p class="truncate font-medium">{note.credit_note_number}</p>
					<p class="text-xs text-muted-foreground">
						{formatDate(note.issued_at ?? note.created_at)}
					</p>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<span class="font-mono">-{formatMoney(note.amount_gross, currency)}</span>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => onDownload(note.id)}
						disabled={downloadingId !== null}
						aria-label={m['myInvoices.downloadCreditNote']({ number: note.credit_note_number })}
					>
						{#if downloadingId === note.id}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{:else}
							<Download class="h-4 w-4" aria-hidden="true" />
						{/if}
					</Button>
				</div>
			</li>
		{/each}
	</ul>
</section>
