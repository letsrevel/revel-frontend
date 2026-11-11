<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
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
	const voidHintId = $derived(`void-hint-${payment.id}`);
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
	<Tooltip.Provider>
		<Tooltip.Root>
			<!-- The Button is the trigger (child snippet): a default Trigger would wrap it in a
			     <button>, an interactive-inside-interactive violation. The hint is also linked
			     as the button's accessible description, so screen readers hear it without
			     having to hover or focus. -->
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						size="sm"
						{variant}
						aria-label={m['orgAdmin.members.subscriptions.paymentActions.voidFor'](context)}
						aria-describedby={voidHintId}
						onclick={() => onVoid(payment)}
					>
						{m['orgAdmin.members.subscriptions.paymentActions.void']()}
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<span id={voidHintId} class="sr-only">
				{m['orgAdmin.members.subscriptions.paymentActions.voidHint']()}
			</span>
			<!-- Portalled to <body>: this sits inside the drawer's overflow-y-auto body, which
			     would clip an in-place popover. z-[60] keeps it above the drawer (z-50). -->
			<TooltipPrimitive.Portal>
				<Tooltip.Content class="z-[60] max-w-xs">
					<p class="text-xs">{m['orgAdmin.members.subscriptions.paymentActions.voidHint']()}</p>
				</Tooltip.Content>
			</TooltipPrimitive.Portal>
		</Tooltip.Root>
	</Tooltip.Provider>
{/if}
