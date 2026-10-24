<script lang="ts">
	import { Info } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import CopyField from '$lib/components/common/CopyField.svelte';
	import type { CustomDomain } from './custom-domain-api';

	interface Props {
		records: CustomDomain['verification_records'];
	}
	const { records }: Props = $props();

	const isCname = (type: string): boolean => type.toUpperCase() === 'CNAME';
</script>

<!--
	A list of cards rather than a <table>: name and value are long strings
	(certificate tokens) that overflow a three-column table on a phone. Each
	record is its own group, with the copy buttons named after the record.
-->
<ol class="space-y-3">
	{#each records as record, i (i)}
		<li
			class="rounded-lg border bg-card p-4"
			aria-labelledby={`custom-domain-record-${i}`}
			data-testid="dns-record"
		>
			<p id={`custom-domain-record-${i}`} class="mb-3 text-sm font-bold">
				{m['customDomain.records.recordHeading']({
					number: i + 1,
					total: records.length,
					type: record.type
				})}
			</p>
			<dl class="space-y-3 text-sm">
				<div>
					<dt class="mb-1 font-semibold text-muted-foreground">
						{m['customDomain.records.type']()}
					</dt>
					<dd class="font-mono">{record.type}</dd>
				</div>
				<div>
					<dt class="mb-1 font-semibold text-muted-foreground">
						{m['customDomain.records.name']()}
					</dt>
					<dd>
						<CopyField
							id={`custom-domain-record-${i}-name`}
							value={record.name}
							label={m['customDomain.records.nameLabel']({ number: i + 1, type: record.type })}
						/>
					</dd>
				</div>
				<div>
					<dt class="mb-1 font-semibold text-muted-foreground">
						{m['customDomain.records.value']()}
					</dt>
					<dd>
						<CopyField
							id={`custom-domain-record-${i}-value`}
							value={record.value}
							label={m['customDomain.records.valueLabel']({ number: i + 1, type: record.type })}
							describedBy={isCname(record.type) ? `custom-domain-record-${i}-hint` : undefined}
						/>
						{#if isCname(record.type)}
							<p
								id={`custom-domain-record-${i}-hint`}
								class="mt-1.5 text-xs text-muted-foreground"
								data-testid="cname-value-hint"
							>
								{m['customDomain.records.cnameHint']()}
							</p>
						{/if}
					</dd>
				</div>
			</dl>
			{#if isCname(record.type)}
				<p
					class="mt-3 flex items-start gap-2 rounded-md border border-info/40 bg-info/10 p-3 text-sm"
					data-testid="cname-cloudflare-warning"
				>
					<Info class="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
					<strong>{m['customDomain.records.cloudflareNote']()}</strong>
				</p>
			{/if}
		</li>
	{/each}
</ol>
