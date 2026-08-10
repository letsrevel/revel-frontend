<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		seriespassDownloadSeriesPassPkpass,
		ticketwalletDownloadApplePass
	} from '$lib/api/generated/sdk.gen';

	interface Props {
		/** Ticket id (kind 'ticket') or held series-pass id (kind 'series-pass'). */
		id: string;
		kind?: 'ticket' | 'series-pass';
		/** Event or pass name — used only for the downloaded .pkpass filename. */
		name: string;
		class?: string;
	}

	const { id, kind = 'ticket', name, class: className = '' }: Props = $props();

	let isDownloading = $state(false);
	let error = $state<string | null>(null);

	// Official "Add to Apple Wallet" badge artwork (fixed per Apple's Add to
	// Apple Wallet guidelines — never restyled). Only the US-English badge is
	// freely distributable; Apple's localized variants require a signed-in
	// developer download — drop them in as apple-wallet-badge-<locale>.svg and
	// switch this to a getLocale() lookup when available.
	const badgeSrc = '/wallet/apple-wallet-badge-en.svg';

	async function downloadApplePass() {
		if (isDownloading) return;
		isDownloading = true;
		error = null;

		try {
			const response =
				kind === 'ticket'
					? await ticketwalletDownloadApplePass({
							path: { ticket_id: id },
							// Request raw response to handle binary data
							parseAs: 'stream'
						})
					: await seriespassDownloadSeriesPassPkpass({
							path: { held_pass_id: id },
							parseAs: 'stream'
						});

			if (!response.response?.ok) {
				if (response.response?.status === 503) {
					throw new Error(m['addToWallet.notConfigured']());
				}
				if (response.response?.status === 404) {
					throw new Error(
						kind === 'ticket' ? m['addToWallet.ticketNotFound']() : m['seriesPass.passNotFound']()
					);
				}
				throw new Error(
					kind === 'ticket'
						? m['addToWallet.downloadFailed']()
						: m['seriesPass.walletDownloadFailed']()
				);
			}

			// Get the blob and trigger a download with a safe filename
			const blob = await response.response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			const safeName = name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.substring(0, 30);
			link.download = `${safeName}-${id.split('-')[0]}.pkpass`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Failed to download Apple Wallet pass:', err);
			error = err instanceof Error ? err.message : m['addToWallet.downloadFailed']();
		} finally {
			isDownloading = false;
		}
	}
</script>

<button
	type="button"
	onclick={downloadApplePass}
	disabled={isDownloading}
	aria-busy={isDownloading}
	aria-label={m['addToWallet.addToAppleWallet']()}
	class="inline-flex items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-progress disabled:opacity-70 {className}"
>
	<img src={badgeSrc} alt="" class="h-12 w-auto" draggable="false" />
</button>

{#if error}
	<p class="mt-2 text-sm text-destructive" role="alert">
		{error}
	</p>
{/if}
