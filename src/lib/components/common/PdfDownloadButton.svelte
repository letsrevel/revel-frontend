<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Download, Loader2 } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		/**
		 * Fetches and saves the PDF. It owns its own error reporting (a localized
		 * toast, never raw backend text) — this button owns only the pending state,
		 * so a rejected promise still clears the spinner.
		 */
		onDownload: () => Promise<void>;
		/** Visible label. Defaults to the shared "Download PDF" string. */
		label?: string;
		class?: string;
	}

	const { onDownload, label = m['downloadPdf.download'](), class: className }: Props = $props();

	let isDownloading = $state(false);

	async function handleClick(): Promise<void> {
		// Re-entrancy guard: `disabled` alone loses the race between the click and
		// the first await, and a double download writes the same file twice.
		if (isDownloading) return;
		isDownloading = true;
		try {
			await onDownload();
		} catch (err) {
			// The callback is supposed to report its own failure, so reaching here
			// is a caller bug. Log it rather than letting it escape as an unhandled
			// rejection — and never toast, or a caller that already did would
			// double-report.
			console.error('PDF download callback rejected:', err);
		} finally {
			isDownloading = false;
		}
	}
</script>

<!--
	The single PDF-download button for generated documents (tickets, series
	passes, membership cards). A bordered chip rather than a filled primary: it
	sits directly above the official Apple/Google wallet badges, which carry
	their own fixed branding, and a primary fill there competed with them.
-->
<button
	type="button"
	onclick={handleClick}
	disabled={isDownloading}
	class={cn(
		'inline-flex items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50',
		className
	)}
>
	{#if isDownloading}
		<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
	{:else}
		<Download class="h-4 w-4" aria-hidden="true" />
	{/if}
	{label}
</button>
