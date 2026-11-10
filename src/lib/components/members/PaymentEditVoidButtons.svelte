<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { paymentContext, type EditablePayment } from './paymentEdit';

	interface Props {
		payment: EditablePayment;
		onEdit: (payment: EditablePayment) => void;
		onVoid: (payment: EditablePayment) => void;
		variant?: 'ghost' | 'outline';
	}

	const { payment, onEdit, onVoid, variant = 'ghost' }: Props = $props();

	// Names carry the amount and date: the drawer and the ledger list many rows,
	// and a bare "Edit" says nothing about which one it acts on.
	const context = $derived(paymentContext(payment));
	// Eligibility comes from the backend flags; nothing is re-derived here.
	const showEdit = $derived(!!payment.id && payment.can_edit);
	const showVoid = $derived(!!payment.id && payment.can_void);
</script>

{#if showEdit}
	<Button
		size="sm"
		{variant}
		aria-label={m['orgAdmin.members.subscriptions.paymentActions.editFor'](context)}
		onclick={() => onEdit(payment)}
	>
		{m['orgAdmin.members.subscriptions.paymentActions.edit']()}
	</Button>
{/if}
{#if showVoid}
	<Button
		size="sm"
		{variant}
		aria-label={m['orgAdmin.members.subscriptions.paymentActions.voidFor'](context)}
		onclick={() => onVoid(payment)}
	>
		{m['orgAdmin.members.subscriptions.paymentActions.void']()}
	</Button>
{/if}
