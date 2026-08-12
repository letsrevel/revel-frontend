<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { membershipwalletDownloadPdf } from '$lib/api';
	import { Download, Loader2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import AddToWalletButton from '$lib/components/tickets/AddToWalletButton.svelte';
	import AddToGoogleWalletButton from '$lib/components/tickets/AddToGoogleWalletButton.svelte';
	import { detectWalletPlatform } from '$lib/utils/platform';
	import { toFilenameSlug } from '$lib/utils/filename';

	interface Props {
		/** Organization slug — membership wallet endpoints are slug-addressed. */
		slug: string;
		/** Organization name — used only for the downloaded filenames. */
		organizationName: string;
		/**
		 * The backend's own `apple_pass_available` / `google_pass_available` flags.
		 * They are already STATUS-AWARE (a banned or cancelled member gets `false`),
		 * so there is deliberately no client-side status gating here — re-deriving
		 * it would be a second, drifting source of truth for the same question.
		 */
		applePassAvailable: boolean;
		googlePassAvailable: boolean;
	}

	const { slug, organizationName, applePassAvailable, googlePassAvailable }: Props = $props();

	// Ordering only (never hides a rail): Google badge first on Android.
	let googleWalletFirst = $state(false);
	onMount(() => {
		googleWalletFirst = detectWalletPlatform() === 'android';
	});

	let isDownloadingPdf = $state(false);

	const safeName = $derived(toFilenameSlug(organizationName, 'membership'));

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
			const response = await membershipwalletDownloadPdf({
				path: { slug },
				parseAs: 'stream'
			});
			if (!response.response?.ok) {
				toast.error(
					response.response?.status === 404
						? m['membershipCard.notFound']()
						: m['membershipCard.pdfDownloadFailed']()
				);
				return;
			}
			saveBlob(await response.response.blob(), `${safeName}-membership.pdf`);
		} catch (err) {
			// Same discipline as the wallet badges: raw error text is unlocalized
			// and may carry backend detail, so it is logged and never shown.
			console.error('Failed to download membership PDF:', err);
			toast.error(m['membershipCard.pdfDownloadFailed']());
		} finally {
			isDownloadingPdf = false;
		}
	}
</script>

<!--
	Mirrors `series-passes/HeldPassDownloadButtons`: a PDF button above the two
	official wallet badges, whose order (never their presence) follows the device.
	The PDF is ungated — it is the fallback for a member whose organization has no
	wallet integration configured at all.
-->
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
		{m['membershipCard.downloadPdf']()}
	</button>

	{#snippet googleWalletButton()}
		<AddToGoogleWalletButton kind="membership" {slug} />
	{/snippet}

	{#if applePassAvailable || googlePassAvailable}
		<div class="flex flex-wrap items-center justify-center gap-2">
			{#if googleWalletFirst && googlePassAvailable}
				{@render googleWalletButton()}
			{/if}
			{#if applePassAvailable}
				<AddToWalletButton kind="membership" {slug} name={organizationName} />
			{/if}
			{#if !googleWalletFirst && googlePassAvailable}
				{@render googleWalletButton()}
			{/if}
		</div>
	{/if}
</div>
