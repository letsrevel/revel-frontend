<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { MailWarning, X } from '@lucide/svelte';
	import type { EmailSuppressionStatusSchema } from '$lib/api/generated/types.gen';
	import { formatDate } from '$lib/utils/date';
	import { cn } from '$lib/utils';

	/**
	 * Revel stopped emailing the viewer's address (#987, backend #1038): a hard
	 * bounce, an invalid or blocked address, or a spam complaint. Deliberately
	 * no self-service "unblock" and no `+alias` hint (aliases normalise to the
	 * same address and stay suppressed): the ways out are a different address
	 * (suppression is keyed by address) or support.
	 *
	 * Colors: the audited warning recipe (border-highlight/40 bg-highlight/20 +
	 * text-highlight-foreground, dark:text-highlight) over the page background,
	 * as in tickets/MyTicketModal. It is a persistent notice, not an alert, so it
	 * is a labelled region rather than role="alert".
	 */
	interface Props {
		suppression: EmailSuppressionStatusSchema;
		/** Global layout copy: offers a dismiss (per browser session). */
		onDismiss?: () => void;
		class?: string;
	}

	const { suppression, onDismiss, class: className }: Props = $props();

	const titleId = $props.id();

	// A complaint is the recipient's own action; everything else is delivery.
	const title = $derived(
		suppression.reason === 'complaint'
			? m['emailSuppression.complaintTitle']()
			: m['emailSuppression.undeliverableTitle']()
	);
	const supportSubject = $derived(encodeURIComponent(m['emailSuppression.supportSubject']()));
</script>

<section
	aria-labelledby={titleId}
	class={cn('rounded-lg border border-highlight/40 bg-highlight/20 p-4', className)}
>
	<div class="flex items-start gap-3">
		<MailWarning
			class="mt-0.5 h-5 w-5 shrink-0 text-highlight-foreground dark:text-highlight"
			aria-hidden="true"
		/>
		<div class="min-w-0 flex-1 text-highlight-foreground dark:text-highlight">
			<p id={titleId} class="font-bold">{title}</p>
			<p class="mt-1 text-sm">
				{m['emailSuppression.body']({ date: formatDate(suppression.since) })}
			</p>
			<div class="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
				<a
					href="{resolve('/(auth)/account/security', {})}#email"
					class="inline-flex min-h-10 items-center justify-center rounded-md bg-highlight px-3 py-1.5 text-sm font-semibold text-highlight-foreground transition-colors hover:bg-highlight/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{m['emailSuppression.changeEmail']()}
				</a>
				<a
					href="mailto:contact@letsrevel.io?subject={supportSubject}"
					class="inline-flex min-h-10 items-center justify-center rounded-md px-3 py-1.5 text-sm font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{m['emailSuppression.contactSupport']()}
				</a>
			</div>
		</div>
		{#if onDismiss}
			<button
				type="button"
				onclick={onDismiss}
				class="-m-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={m['emailSuppression.dismiss']()}
			>
				<X class="h-4 w-4 text-highlight-foreground dark:text-highlight" aria-hidden="true" />
			</button>
		{/if}
	</div>
</section>
