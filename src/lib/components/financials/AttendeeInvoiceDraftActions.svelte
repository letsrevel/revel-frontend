<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Edit3, Send, Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import ComplianceCallout from '$lib/components/compliance/ComplianceCallout.svelte';

	/**
	 * Edit / Issue / Delete for a draft attendee invoice. A draft the country
	 * rules no longer let Revel issue (`issue_blocked_reason`, #1008) keeps Edit
	 * and Delete; Issue is disabled and described by the backend's reason.
	 */
	interface Props {
		blockedReason?: string;
		onEdit: () => void;
		onIssue: () => void;
		onDelete: () => void;
	}

	const { blockedReason = '', onEdit, onIssue, onDelete }: Props = $props();

	const uid = $props.id();
	const blocked = $derived(blockedReason.trim() !== '');
</script>

<div class="flex flex-col gap-2">
	{#if blocked}
		<ComplianceCallout tone="blocked" id="{uid}-blocked" testId="issue-blocked-reason">
			<p>{blockedReason}</p>
		</ComplianceCallout>
	{/if}
	<Button variant="outline" class="w-full" onclick={onEdit}>
		<Edit3 class="mr-2 h-4 w-4" aria-hidden="true" />{m['orgAdmin.billing.attendeeInvoices.edit']()}
	</Button>
	<Button
		class="w-full"
		onclick={onIssue}
		disabled={blocked}
		aria-describedby={blocked ? `${uid}-blocked` : undefined}
	>
		<Send class="mr-2 h-4 w-4" aria-hidden="true" />{m['orgAdmin.billing.attendeeInvoices.issue']()}
	</Button>
	<Button variant="destructive" class="w-full" onclick={onDelete}>
		<Trash2 class="mr-2 h-4 w-4" aria-hidden="true" />{m[
			'orgAdmin.billing.attendeeInvoices.deleteInvoice'
		]()}
	</Button>
</div>
