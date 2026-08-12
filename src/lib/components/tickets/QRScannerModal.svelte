<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import QrCameraScanner from './QrCameraScanner.svelte';
	import { X } from '@lucide/svelte';

	/**
	 * Dialog wrapper around `QrCameraScanner`. Everything camera-shaped — the
	 * getUserMedia lifecycle, the front-camera fallback, the per-error copy and
	 * the manual-entry fallback — lives in that component, which the org door page
	 * embeds without a dialog around it.
	 *
	 * Single-shot by design: the parent closes this modal in response to a scan,
	 * so the camera stays stopped rather than resuming (`continuous` is off).
	 */
	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onScan: (ticketId: string) => Promise<void>;
	}

	const { isOpen, onClose, onScan }: Props = $props();
</script>

{#if isOpen}
	<!-- Modal Overlay -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
		role="dialog"
		aria-modal="true"
		aria-labelledby="qr-scanner-title"
	>
		<!-- Modal Content -->
		<div class="relative w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
			<div class="mb-4 flex items-center justify-between">
				<h2 id="qr-scanner-title" class="text-xl font-bold">{m['qrScannerModal.scanQr']()}</h2>
				<button
					type="button"
					onclick={onClose}
					class="rounded-full p-1 hover:bg-accent"
					aria-label={m['qrScannerModal.closeLabel']()}
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<p class="mb-4 text-sm text-muted-foreground">
				{m['qrScannerModal.instructions']()}
			</p>

			<!-- Mounted only while open, so every reopen starts from a clean camera and
			     an empty manual-entry field; `onDestroy` in the child stops and clears
			     the html5-qrcode instance on the way out. -->
			<QrCameraScanner active={isOpen} {onScan} />

			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={onClose}>{m['qrScannerModal.cancel']()}</Button>
			</div>
		</div>
	</div>
{/if}
