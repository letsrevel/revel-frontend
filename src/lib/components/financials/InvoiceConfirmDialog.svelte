<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import InvoiceNotIssuableAlert from '$lib/components/compliance/InvoiceNotIssuableAlert.svelte';

	/**
	 * Confirm step for issuing or deleting an attendee invoice draft. `refusal`
	 * is the issue endpoint's 422 `detail` (#1001), shown inline: it only fires
	 * when the country rules changed after the list loaded, since a draft that's
	 * already blocked has its Issue button disabled (#1008).
	 */
	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		title: string;
		description: string;
		buttonLabel: string;
		onConfirm: () => void;
		isPending: boolean;
		variant: 'default' | 'destructive';
		refusal?: string | null;
	}

	const {
		open,
		onOpenChange,
		title,
		description,
		buttonLabel,
		onConfirm,
		isPending,
		variant,
		refusal = null
	}: Props = $props();
</script>

<Dialog {open} {onOpenChange}>
	<DialogContent class="max-h-[90vh] overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{title}</DialogTitle>
			<DialogDescription>{description}</DialogDescription>
		</DialogHeader>
		{#if refusal}<InvoiceNotIssuableAlert detail={refusal} />{/if}
		<DialogFooter>
			<Button variant="outline" onclick={() => onOpenChange(false)}>{m['common.cancel']()}</Button>
			<Button {variant} onclick={onConfirm} disabled={isPending || !!refusal}>
				{#if isPending}<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />{/if}
				{buttonLabel}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
