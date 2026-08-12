<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { seriespassDownloadSeriesPassPdf } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import AddToWalletButton from '$lib/components/tickets/AddToWalletButton.svelte';
	import AddToGoogleWalletButton from '$lib/components/tickets/AddToGoogleWalletButton.svelte';
	import PdfDownloadButton from '$lib/components/common/PdfDownloadButton.svelte';
	import { detectWalletPlatform } from '$lib/utils/platform';
	import { saveBlob } from '$lib/utils/download';
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

	const safeName = $derived(toFilenameSlug(passName, 'pass'));

	async function downloadPdf(): Promise<void> {
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
		}
	}
</script>

<div class="flex flex-col gap-2">
	<PdfDownloadButton onDownload={downloadPdf} label={m['seriesPass.downloadPdf']()} />
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
