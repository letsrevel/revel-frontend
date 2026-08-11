<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { membershipwalletDownloadPdf } from '$lib/api';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import AddToWalletButton from '$lib/components/tickets/AddToWalletButton.svelte';
	import AddToGoogleWalletButton from '$lib/components/tickets/AddToGoogleWalletButton.svelte';
	import PdfDownloadButton from '$lib/components/common/PdfDownloadButton.svelte';
	import { detectWalletPlatform } from '$lib/utils/platform';
	import { saveBlob } from '$lib/utils/download';
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

	const safeName = $derived(toFilenameSlug(organizationName, 'membership'));

	async function downloadPdf(): Promise<void> {
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
	<PdfDownloadButton onDownload={downloadPdf} label={m['membershipCard.downloadPdf']()} />

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
