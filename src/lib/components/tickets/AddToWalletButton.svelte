<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { ticketwalletDownloadApplePass } from '$lib/api/generated/sdk.gen';
	import { Wallet } from 'lucide-svelte';

	interface Props {
		ticketId: string;
		eventName: string;
		/**
		 * Visual variant:
		 * - 'default': Full button with black background (Apple Wallet branding)
		 * - 'secondary': Full button with white background (matches other action buttons)
		 * - 'compact': Icon only button
		 */
		variant?: 'default' | 'secondary' | 'compact';
		class?: string;
	}

	let { ticketId, eventName, variant = 'default', class: className = '' }: Props = $props();

	let isDownloading = $state(false);
	let error = $state<string | null>(null);

	async function downloadApplePass() {
		isDownloading = true;
		error = null;

		try {
			const response = await ticketwalletDownloadApplePass({
				path: {
					ticket_id: ticketId
				},
				// Request raw response to handle binary data
				parseAs: 'stream'
			});

			// Check if we got a valid response
			if (!response.response.ok) {
				if (response.response.status === 503) {
					throw new Error('Apple Wallet is not configured for this event');
				} else if (response.response.status === 404) {
					throw new Error('Ticket not found');
				} else {
					throw new Error('Failed to download wallet pass');
				}
			}

			// Get the blob from the response
			const blob = await response.response.blob();

			// Create a download link
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			// Use a safe filename based on event name and ticket ID
			const safeName = eventName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.substring(0, 30);
			link.download = `${safeName}-${ticketId.split('-')[0]}.pkpass`;

			// Trigger download
			document.body.appendChild(link);
			link.click();

			// Cleanup
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Failed to download Apple Wallet pass:', err);
			error = err instanceof Error ? err.message : 'Failed to download wallet pass';
		} finally {
			isDownloading = false;
		}
	}
</script>

{#if variant === 'compact'}
	<!-- Compact variant: Icon only (for space-constrained layouts) -->
	<button
		type="button"
		onclick={downloadApplePass}
		disabled={isDownloading}
		class="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {className}"
		aria-label="Add to Apple Wallet"
		title="Add to Apple Wallet"
	>
		{#if isDownloading}
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
				aria-hidden="true"
			></div>
		{:else}
			<Wallet class="h-4 w-4" aria-hidden="true" />
		{/if}
	</button>
{:else if variant === 'secondary'}
	<!-- Secondary variant: Full button with white background (matches action buttons) -->
	<button
		type="button"
		onclick={downloadApplePass}
		disabled={isDownloading}
		class="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {className}"
		aria-label="Add to Apple Wallet"
	>
		{#if isDownloading}
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
				aria-hidden="true"
			></div>
			<span>{m['addToWallet.downloading']()}</span>
		{:else}
			<Wallet class="h-4 w-4" aria-hidden="true" />
			<span>{m['addToWallet.addToAppleWallet']()}</span>
		{/if}
	</button>
{:else}
	<!-- Default variant: Full button with Apple Wallet branding (black background) -->
	<button
		type="button"
		onclick={downloadApplePass}
		disabled={isDownloading}
		class="inline-flex items-center justify-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:focus:ring-gray-100 {className}"
		aria-label="Add to Apple Wallet"
	>
		{#if isDownloading}
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-black dark:border-t-transparent"
				aria-hidden="true"
			></div>
			<span>{m['addToWallet.downloading']()}</span>
		{:else}
			<Wallet class="h-4 w-4" aria-hidden="true" />
			<span>{m['addToWallet.addToAppleWallet']()}</span>
		{/if}
	</button>
{/if}

<!-- Error message -->
{#if error}
	<p class="mt-2 text-sm text-destructive" role="alert">
		{error}
	</p>
{/if}
