<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { ticketwalletDownloadPdf } from '$lib/api/generated/sdk.gen';
	import { FileDown } from 'lucide-svelte';

	interface Props {
		ticketId: string;
		/** Pre-signed PDF URL from ticket data, used for direct download when available */
		pdfUrl?: string | null;
		/**
		 * Visual variant:
		 * - 'default': Primary styled button
		 * - 'secondary': Outline styled button
		 */
		variant?: 'default' | 'secondary';
		class?: string;
	}

	let { ticketId, pdfUrl, variant = 'default', class: className = '' }: Props = $props();

	let isDownloading = $state(false);
	let error = $state<string | null>(null);

	async function downloadPdf() {
		isDownloading = true;
		error = null;

		try {
			// If we have a pre-signed URL, use it directly
			if (pdfUrl) {
				window.open(pdfUrl, '_blank');
				return;
			}

			// Otherwise, use the API endpoint (handles generation + caching)
			const response = await ticketwalletDownloadPdf({
				path: {
					ticket_id: ticketId
				},
				parseAs: 'stream'
			});

			if (!response.response.ok) {
				if (response.response.status === 404) {
					throw new Error('Ticket not found');
				}
				throw new Error('Failed to download PDF');
			}

			// Handle redirect (302) — the fetch API follows redirects automatically,
			// so we'll get the final PDF content
			const blob = await response.response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `ticket-${ticketId}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Failed to download PDF:', err);
			error = err instanceof Error ? err.message : 'Failed to download PDF';
		} finally {
			isDownloading = false;
		}
	}
</script>

{#if variant === 'secondary'}
	<button
		type="button"
		onclick={downloadPdf}
		disabled={isDownloading}
		class="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {className}"
		aria-label={m['downloadPdf.download']()}
	>
		{#if isDownloading}
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
				aria-hidden="true"
			></div>
			<span>{m['downloadPdf.downloading']()}</span>
		{:else}
			<FileDown class="h-4 w-4" aria-hidden="true" />
			<span>{m['downloadPdf.download']()}</span>
		{/if}
	</button>
{:else}
	<button
		type="button"
		onclick={downloadPdf}
		disabled={isDownloading}
		class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {className}"
		aria-label={m['downloadPdf.download']()}
	>
		{#if isDownloading}
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
				aria-hidden="true"
			></div>
			<span>{m['downloadPdf.downloading']()}</span>
		{:else}
			<FileDown class="h-4 w-4" aria-hidden="true" />
			<span>{m['downloadPdf.download']()}</span>
		{/if}
	</button>
{/if}

{#if error}
	<p class="mt-2 text-sm text-destructive" role="alert">
		{error}
	</p>
{/if}
