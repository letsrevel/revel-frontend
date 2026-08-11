<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		membershipwalletGoogleWalletSaveLink,
		seriespassGoogleWalletSaveLink,
		ticketwalletGoogleWalletSaveLink
	} from '$lib/api/generated/sdk.gen';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { Loader2 } from '@lucide/svelte';

	/** Same union rationale as `AddToWalletButton`: memberships are slug-addressed. */
	type Props = { class?: string } & (
		| { kind?: 'ticket' | 'series-pass'; id: string; slug?: never }
		| { kind: 'membership'; slug: string; id?: never }
	);

	// NOT destructured — see `AddToWalletButton` for why.
	const props: Props = $props();

	const kind = $derived(props.kind ?? 'ticket');
	const className = $derived(props.class ?? '');

	let isOpening = $state(false);
	let error = $state<string | null>(null);

	// Official localized "Add to Google Wallet" badge artwork (fixed per brand
	// guidelines — never restyled); one variant per app locale in static/wallet/.
	const badgeSrc = $derived(`/wallet/google-wallet-badge-${getLocale()}.svg`);

	/** Per-kind copy, so a 404 names the thing the member actually asked for. */
	function notFoundMessage(): string {
		if (kind === 'membership') return m['membershipCard.notFound']();
		if (kind === 'series-pass') return m['seriesPass.passNotFound']();
		return m['addToWallet.ticketNotFound']();
	}

	async function openSaveLink(): Promise<void> {
		if (isOpening) return;
		isOpening = true;
		error = null;

		try {
			// The pass is created by Google when the user opens the signed save
			// link — there is no file download. `format=json` returns the URL
			// instead of a cross-origin 302 the SPA could not follow.
			const result =
				props.kind === 'membership'
					? await membershipwalletGoogleWalletSaveLink({
							path: { slug: props.slug },
							query: { format: 'json' }
						})
					: props.kind === 'series-pass'
						? await seriespassGoogleWalletSaveLink({
								path: { held_pass_id: props.id },
								query: { format: 'json' }
							})
						: await ticketwalletGoogleWalletSaveLink({
								path: { ticket_id: props.id },
								query: { format: 'json' }
							});

			if (!result.response?.ok || !result.data) {
				// Known statuses map to localized messages directly; the catch
				// below never surfaces raw error text (unlocalized, and may
				// leak backend detail) — it logs and shows the generic message.
				if (result.response?.status === 503) {
					error = m['addToGoogleWallet.notConfigured']();
				} else if (result.response?.status === 404) {
					error = notFoundMessage();
				} else {
					error = m['addToGoogleWallet.openFailed']();
				}
				return;
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
			error = m['addToGoogleWallet.openFailed']();
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
