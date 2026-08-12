<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { seriespassDownloadSeriesPassPdf } from '$lib/api';
	import { Download, Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import AddToWalletButton from '$lib/components/tickets/AddToWalletButton.svelte';
	import AddToGoogleWalletButton from '$lib/components/tickets/AddToGoogleWalletButton.svelte';
	import { detectWalletPlatform } from '$lib/utils/platform';
	import { toFilenameSlug } from '$lib/utils/filename';

	interface Props {
		heldPassId: string;
		passName: string;
	}

	const { heldPassId, passName }: Props = $props();

	// Ordering only (never hides a rail): Google badge first on Android.
	let googleWalletFirst = $state(false);
	onMount(() => {
		googleWalletFirst = detectWalletPlatform() === 'android';
	});

	let isDownloadingPdf = $state(false);

	const safeName = $derived(toFilenameSlug(passName, 'pass'));

	function saveBlob(blob: Blob, filename: string): void {
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.URL.revokeObjectURL(url);
	}

	async function downloadPdf(): Promise<void> {
		if (isDownloadingPdf) return;
		isDownloadingPdf = true;
		try {
			const response = await seriespassDownloadSeriesPassPdf({
				path: { held_pass_id: heldPassId },
				parseAs: 'stream'
			});
			if (!response.response?.ok) {
				toast.error(
					response.response?.status === 404
						? m['seriesPass.passNotFound']()
						: m['seriesPass.pdfDownloadFailed']()
				);
				return;
			}
			saveBlob(await response.response.blob(), `${safeName}-pass.pdf`);
		} catch (err) {
			// Raw error text is unlocalized and may carry backend detail: the old
			// `err.message` path leaked things like "ECONNRESET from upstream" into
			// a toast. Log it, show the localized line. Same rule the wallet badges
			// have always followed.
			console.error('Failed to download series-pass PDF:', err);
			toast.error(m['seriesPass.pdfDownloadFailed']());
		} finally {
			isDownloadingPdf = false;
		}
	}
</script>

<div class="flex flex-col gap-2">
	<button
		type="button"
		onclick={downloadPdf}
		disabled={isDownloadingPdf}
		class="inline-flex items-center justify-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
	>
		{#if isDownloadingPdf}
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
		{:else}
			<Download class="h-4 w-4" aria-hidden="true" />
		{/if}
		{m['seriesPass.downloadPdf']()}
	</button>
	{#snippet googleWalletButton()}
		<AddToGoogleWalletButton id={heldPassId} kind="series-pass" />
	{/snippet}
	<div class="flex flex-wrap items-center justify-center gap-2">
		{#if googleWalletFirst}
			{@render googleWalletButton()}
		{/if}
		<AddToWalletButton id={heldPassId} kind="series-pass" name={passName} />
		{#if !googleWalletFirst}
			{@render googleWalletButton()}
		{/if}
	</div>
</div>
