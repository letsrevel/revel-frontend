<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { CheckCircle2, Pencil } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { SkippedFiscalDocumentSchema } from '$lib/api/generated/types.gen';
	import { formatMoney } from '$lib/utils/format';
	import { formatDate } from '$lib/utils/date';
	import { countryName } from '$lib/utils/compliance';
	import { kindLabel, resolveActionId } from './skipped-documents';

	/**
	 * Invoices and credit notes Revel skipped under a country policy (#1008),
	 * owner-only. The status pairs a text badge with the reference, never colour
	 * alone; each row's action button carries a stable id so focus can come back
	 * to it after "Mark as issued".
	 */
	interface Props {
		documents: SkippedFiscalDocumentSchema[];
		orgSlug: string;
		onResolve: (doc: SkippedFiscalDocumentSchema) => void;
	}

	const { documents, orgSlug, onResolve }: Props = $props();
</script>

<div class="overflow-x-auto rounded-lg border">
	<table class="w-full text-sm" data-testid="skipped-documents-table">
		<caption class="sr-only">{m['compliance.skipped.title']()}</caption>
		<thead class="bg-muted/50">
			<tr class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
				<th scope="col" class="px-4 py-3 text-left">{m['compliance.skipped.colDate']()}</th>
				<th scope="col" class="px-4 py-3 text-left">{m['compliance.skipped.colDocument']()}</th>
				<th scope="col" class="px-4 py-3 text-left">{m['compliance.skipped.colEvent']()}</th>
				<th scope="col" class="px-4 py-3 text-left">{m['compliance.skipped.colBuyer']()}</th>
				<th scope="col" class="px-4 py-3 text-right">{m['compliance.skipped.colGross']()}</th>
				<th scope="col" class="px-4 py-3 text-left">{m['compliance.skipped.colStatus']()}</th>
				<th scope="col" class="px-4 py-3 text-right">
					<span class="sr-only">{m['common.actions']()}</span>
				</th>
			</tr>
		</thead>
		<tbody class="divide-y">
			{#each documents as doc (doc.id)}
				<tr data-testid="skipped-document-row">
					<td class="whitespace-nowrap px-4 py-3 text-muted-foreground">
						{formatDate(doc.decided_at)}
					</td>
					<td class="px-4 py-3">
						<div class="font-medium">{kindLabel(doc.kind)}</div>
						<div class="text-xs text-muted-foreground">{countryName(doc.policy_country)}</div>
						{#if doc.invoice_number}
							<div class="text-xs text-muted-foreground">
								{m['compliance.skipped.correctsInvoice']({ number: doc.invoice_number })}
							</div>
						{/if}
					</td>
					<td class="px-4 py-3">
						{#if doc.event_id}
							<div>{doc.event_name}</div>
							{#if doc.ticket_ids.length > 0}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() validates the path; the appended query cannot be expressed through resolve() -->
								<a
									href={`${resolve('/(auth)/org/[slug]/admin/events/[event_id]/tickets', {
										slug: orgSlug,
										event_id: doc.event_id
									})}?invoice_skipped=true`}
									class="text-xs text-primary underline underline-offset-2 hover:text-foreground"
								>
									{m['compliance.skipped.viewTickets']()}
									<span class="sr-only">({doc.event_name})</span>
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/if}
						{:else}
							<span class="text-muted-foreground">{m['compliance.skipped.deletedEvent']()}</span>
						{/if}
					</td>
					<td class="px-4 py-3">
						<div>{doc.buyer_name || doc.buyer_email}</div>
						{#if doc.buyer_vat_id}
							<div class="font-mono text-xs text-muted-foreground">
								{m['compliance.skipped.buyerVatId']({ vatId: doc.buyer_vat_id })}
							</div>
						{/if}
					</td>
					<td class="whitespace-nowrap px-4 py-3 text-right font-mono">
						{formatMoney(doc.total_gross, doc.currency)}
					</td>
					<td class="px-4 py-3">
						{#if doc.resolved_at}
							<StatusBadge tone="success" size="sm" label={m['compliance.skipped.statusDone']()} />
							<div class="mt-1 text-xs text-muted-foreground">
								{m['compliance.skipped.reference']({ reference: doc.external_reference })}
							</div>
						{:else}
							<StatusBadge tone="warning" size="sm" label={m['compliance.skipped.statusOpen']()} />
						{/if}
					</td>
					<td class="px-4 py-3 text-right">
						<Button
							id={resolveActionId(doc.id)}
							variant={doc.resolved_at ? 'ghost' : 'outline'}
							size="sm"
							class="whitespace-nowrap"
							onclick={() => onResolve(doc)}
						>
							{#if doc.resolved_at}
								<Pencil class="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
								{m['compliance.skipped.editReference']()}
							{:else}
								<CheckCircle2 class="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
								{m['compliance.skipped.markIssued']()}
							{/if}
							<span class="sr-only">
								({kindLabel(doc.kind)}, {doc.buyer_name || doc.buyer_email})
							</span>
						</Button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
