<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { HeldSeriesPassSchema } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import TicketStatusBadge from '$lib/components/tickets/TicketStatusBadge.svelte';
	import HeldPassDownloadButtons from './HeldPassDownloadButtons.svelte';
	import { formatPrice } from '$lib/utils/format';
	import { seriesPassQrPayload } from '$lib/utils/series-pass-qr';
	import QRCode from 'qrcode';
	import { onMount } from 'svelte';

	interface Props {
		open: boolean;
		heldPass: HeldSeriesPassSchema;
		onClose: () => void;
	}

	const { open, heldPass, onClose }: Props = $props();

	let qrCodeDataUrl = $state<string | null>(null);

	// The scanner resolves the pass payload to the holder's ticket for the
	// event being checked in — one QR valid at every covered event.
	const qrPayload = $derived(heldPass.id ? seriesPassQrPayload(heldPass.id) : null);

	onMount(async () => {
		if (!qrPayload) return;
		try {
			qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
				width: 256,
				margin: 2,
				color: { dark: '#000000', light: '#FFFFFF' }
			});
		} catch (err) {
			console.error('Failed to generate QR code:', err);
		}
	});
</script>

<Dialog {open} onOpenChange={(isOpen) => !isOpen && onClose()}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[420px]">
		<DialogHeader>
			<DialogTitle>{heldPass.series_pass.name}</DialogTitle>
			<DialogDescription>{heldPass.series.name}</DialogDescription>
		</DialogHeader>

		<div class="flex flex-col items-center gap-4">
			<TicketStatusBadge status={heldPass.status} />

			{#if heldPass.status === 'pending'}
				<p class="text-center text-sm text-muted-foreground" role="status">
					{m['seriesPass.pendingPaymentNote']()}
				</p>
			{/if}

			{#if qrCodeDataUrl && heldPass.status !== 'cancelled'}
				<div class="rounded-lg border bg-white p-3">
					<img src={qrCodeDataUrl} alt={m['seriesPass.qrAlt']()} class="h-56 w-56" />
				</div>
				<p class="text-center text-xs text-muted-foreground">
					{m['seriesPass.qrHint']()}
				</p>
			{/if}

			<dl class="w-full space-y-1.5 text-sm">
				<div class="flex justify-between">
					<dt class="text-muted-foreground">{m['seriesPass.coverageLabel']()}</dt>
					<dd class="font-medium">
						{m['seriesPass.coverageValue']({
							remaining: heldPass.remaining_event_count,
							total: heldPass.total_event_count
						})}
					</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-muted-foreground">{m['seriesPass.pricePaidLabel']()}</dt>
					<dd class="font-medium">
						{formatPrice(
							heldPass.price_paid,
							heldPass.series_pass.currency,
							m['seriesPass.free']()
						)}
					</dd>
				</div>
			</dl>

			{#if heldPass.id && heldPass.status !== 'cancelled'}
				<div class="w-full">
					<HeldPassDownloadButtons heldPassId={heldPass.id} passName={heldPass.series_pass.name} />
				</div>
			{/if}
		</div>
	</DialogContent>
</Dialog>
