<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		seriespassGoogleWalletSaveLink,
		ticketwalletGoogleWalletSaveLink
	} from '$lib/api/generated/sdk.gen';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { Loader2 } from '@lucide/svelte';

	interface Props {
		/** Ticket id (kind 'ticket') or held series-pass id (kind 'series-pass'). */
		id: string;
		kind?: 'ticket' | 'series-pass';
		class?: string;
	}

	const { id, kind = 'ticket', class: className = '' }: Props = $props();

	let isOpening = $state(false);
	let error = $state<string | null>(null);

	// Official localized "Add to Google Wallet" badge artwork (fixed per brand
	// guidelines — never restyled); one variant per app locale in static/wallet/.
	const badgeSrc = $derived(`/wallet/google-wallet-badge-${getLocale()}.svg`);

	async function openSaveLink(): Promise<void> {
		if (isOpening) return;
		isOpening = true;
		error = null;

		try {
			// The pass is created by Google when the user opens the signed save
			// link — there is no file download. `format=json` returns the URL
			// instead of a cross-origin 302 the SPA could not follow.
			const result =
				kind === 'ticket'
					? await ticketwalletGoogleWalletSaveLink({
							path: { ticket_id: id },
							query: { format: 'json' }
						})
					: await seriespassGoogleWalletSaveLink({
							path: { held_pass_id: id },
							query: { format: 'json' }
						});

			if (!result.response?.ok || !result.data) {
				if (result.response?.status === 503) {
					throw new Error(m['addToGoogleWallet.notConfigured']());
				}
				if (result.response?.status === 404) {
					throw new Error(
						kind === 'ticket' ? m['addToWallet.ticketNotFound']() : m['seriesPass.passNotFound']()
					);
				}
				throw new Error(m['addToGoogleWallet.openFailed']());
			}

			const saveUrl = result.data.save_url;
			// The fetch broke the synchronous click stack, so window.open may be
			// popup-blocked — fall back to same-tab navigation with the URL.
			// Do NOT pass the 'noopener' feature: it makes window.open return
			// null even on success, which would make this fallback always fire
			// (double navigation). Null the opener on the handle instead.
			const opened = window.open(saveUrl, '_blank');
			if (opened) {
				opened.opener = null;
			} else {
				window.location.href = saveUrl;
			}
		} catch (err) {
			console.error('Failed to open Google Wallet save link:', err);
			error = err instanceof Error ? err.message : m['addToGoogleWallet.openFailed']();
		} finally {
			isOpening = false;
		}
	}
</script>

<button
	type="button"
	onclick={openSaveLink}
	disabled={isOpening}
	aria-busy={isOpening}
	aria-label={m['addToGoogleWallet.label']()}
	class="inline-flex items-center justify-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-progress {className}"
>
	{#if isOpening}
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
