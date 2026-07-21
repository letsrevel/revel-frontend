<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { DialogFooter } from '$lib/components/ui/dialog';
	import { formatMoney } from '$lib/utils/format';

	interface Props {
		isSubmitting: boolean;
		onClose: () => void;
		/** Running total for the sticky footer (null = no honest number yet). */
		total?: string | null;
		currency?: string | null;
		/** Free tier: render the "Free" wording instead of €0.00. */
		isFree?: boolean;
	}

	const { isSubmitting, onClose, total = null, currency = null, isFree = false }: Props = $props();

	// Split the translated "Already have an account? <a>Log in</a>" string around
	// its <a> markers so we can render a real anchor instead of {@html}-injecting
	// translator-editable content (latent XSS channel).
	const orLoginParts = $derived.by(() => {
		const message = m['guest_attendance.or_login']();
		const match = message.match(/^(.*)<a>(.*)<\/a>(.*)$/s);
		if (!match) return { before: message, link: '', after: '' };
		return { before: match[1], link: match[2], after: match[3] };
	});
</script>

<div class="shrink-0">
	<!-- Always-visible total: the buyer must never reach the submit button
	     without the money in view (the in-flow estimates scroll away). -->
	{#if total !== null}
		<p class="flex w-full items-center justify-between border-t border-border pt-2 text-sm">
			<span class="text-muted-foreground">{m['checkoutFooter.total']()}</span>
			<span class="text-base font-bold">
				{isFree ? m['ticketConfirmationDialog.free']() : formatMoney(total, currency)}
			</span>
		</p>
	{/if}
	<DialogFooter class="gap-2 pt-4 sm:gap-0">
		<Button
			type="button"
			variant="outline"
			onclick={onClose}
			disabled={isSubmitting}
			class="flex-1 sm:flex-initial"
		>
			{m['guest_attendance.common_cancel']()}
		</Button>
		<Button type="submit" disabled={isSubmitting} class="flex-1 sm:flex-initial">
			{#if isSubmitting}
				{m['guest_attendance.submitting']()}
			{:else}
				{m['guest_attendance.submit_ticket']()}
			{/if}
		</Button>
	</DialogFooter>

	<!-- Subtle login link -->
	<div class="border-t pt-3 text-center text-xs text-muted-foreground">
		<p>
			{orLoginParts.before}{#if orLoginParts.link}<a
					href={resolve('/(public)/login', {})}
					class="text-primary hover:underline">{orLoginParts.link}</a
				>{/if}{orLoginParts.after}
		</p>
	</div>
</div>
