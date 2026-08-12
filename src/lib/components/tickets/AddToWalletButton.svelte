<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		membershipwalletDownloadApplePass,
		seriespassDownloadSeriesPassPkpass,
		ticketwalletDownloadApplePass
	} from '$lib/api/generated/sdk.gen';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { toFilenameSlug } from '$lib/utils/filename';
	import { Loader2 } from '@lucide/svelte';

	/**
	 * Tickets and series passes are addressed by UUID; a membership card is
	 * addressed by its ORGANIZATION SLUG (`/api/me/organizations/{slug}/…`), so it
	 * cannot borrow the `id` prop without lying about what the value is. The two
	 * shapes are a discriminated union rather than one loose `id: string`, which
	 * would have compiled just as happily with a member UUID passed by mistake.
	 */
	type Props = {
		/** Event, pass, or organization name — used only for the downloaded .pkpass filename. */
		name: string;
		class?: string;
	} & (
		| { kind?: 'ticket' | 'series-pass'; id: string; slug?: never }
		| { kind: 'membership'; slug: string; id?: never }
	);

	// NOT destructured: Svelte 5 cannot destructure a union-typed `$props()` —
	// narrowing has to happen on the object. The three read-only locals below
	// keep the markup as legible as the destructured version was.
	const props: Props = $props();

	const kind = $derived(props.kind ?? 'ticket');
	const name = $derived(props.name);
	const className = $derived(props.class ?? '');

	let isDownloading = $state(false);
	let error = $state<string | null>(null);

	// Official localized "Add to Apple Wallet" badge artwork (fixed per
	// Apple's Add to Apple Wallet guidelines — never restyled); one variant
	// per app locale in static/wallet/, from Apple's badge pack (45 locales,
	// developer.apple.com/wallet/add-to-apple-wallet-guidelines/).
	const badgeSrc = $derived(`/wallet/apple-wallet-badge-${getLocale()}.svg`);

	/** Per-kind copy, so a 404 names the thing the member actually asked for. */
	function notFoundMessage(): string {
		if (kind === 'membership') return m['membershipCard.notFound']();
		if (kind === 'series-pass') return m['seriesPass.passNotFound']();
		return m['addToWallet.ticketNotFound']();
	}

	function downloadFailedMessage(): string {
		if (kind === 'membership') return m['membershipCard.walletDownloadFailed']();
		if (kind === 'series-pass') return m['seriesPass.walletDownloadFailed']();
		return m['addToWallet.downloadFailed']();
	}

	async function downloadApplePass(): Promise<void> {
		if (isDownloading) return;
		isDownloading = true;
		error = null;

		try {
			// Request raw responses throughout to handle the binary pass bytes.
			const response =
				props.kind === 'membership'
					? await membershipwalletDownloadApplePass({
							path: { slug: props.slug },
							parseAs: 'stream'
						})
					: props.kind === 'series-pass'
						? await seriespassDownloadSeriesPassPkpass({
								path: { held_pass_id: props.id },
								parseAs: 'stream'
							})
						: await ticketwalletDownloadApplePass({
								path: { ticket_id: props.id },
								parseAs: 'stream'
							});

			if (!response.response?.ok) {
				// Known statuses map to localized messages directly; the catch
				// below never surfaces raw error text (unlocalized, and may
				// leak backend detail) — it logs and shows the generic message.
				if (response.response?.status === 503) {
					error = m['addToWallet.notConfigured']();
				} else if (response.response?.status === 404) {
					error = notFoundMessage();
				} else {
					error = downloadFailedMessage();
				}
				return;
			}

			// Get the blob and trigger a download with a safe filename
			const blob = await response.response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			const safeName = toFilenameSlug(name);
			// A ticket/pass is one of many, so its filename carries the id's first
			// segment to stay unique in a Downloads folder. A membership card is one
			// per organization — the org name alone already disambiguates it, and a
			// slug segment would only repeat what `safeName` says.
			const suffix = props.kind === 'membership' ? 'membership' : props.id.split('-')[0];
			link.download = `${safeName}-${suffix}.pkpass`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Failed to download Apple Wallet pass:', err);
			error = downloadFailedMessage();
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
	class="inline-flex items-center justify-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-progress {className}"
>
	{#if isDownloading}
		<!-- Adjacent spinner: visible busy feedback on touch devices without
		     restyling or obstructing the official badge artwork. -->
		<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
	{/if}
	<img src={badgeSrc} alt="" class="h-12 w-auto" draggable="false" />
</button>

{#if error}
	<!-- basis-full: the call sites place this component in flex-wrap rows, so
	     the error must claim its own row instead of squeezing beside a badge. -->
	<p class="w-full basis-full text-center text-sm text-destructive" role="alert">
		{error}
	</p>
{/if}
