<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onDestroy } from 'svelte';
	import { Html5Qrcode } from 'html5-qrcode';
	import { Button } from '$lib/components/ui/button';
	import { classifyCameraError } from '$lib/utils/camera-errors';
	import { Camera, AlertCircle, KeyRound } from '@lucide/svelte';

	/**
	 * The camera surface itself: getUserMedia lifecycle, the front-camera
	 * fallback, per-error copy, and the manual-entry field that is the guaranteed
	 * way in when the camera won't start.
	 *
	 * Extracted from `QRScannerModal` (now a thin dialog wrapper around this) so
	 * the org door page can embed a scanner that is NOT a modal — door duty is a
	 * queue, and a dialog that closes on every scan fights that.
	 */
	interface Props {
		/** The camera runs only while true. */
		active: boolean;
		/**
		 * Handles a decoded or hand-typed code. A rejection surfaces the generic
		 * "could not process" message and, in continuous mode, resumes scanning.
		 */
		onScan: (code: string) => Promise<void>;
		/**
		 * Door mode: resume the camera after each handled scan instead of leaving
		 * it stopped for a parent that is about to unmount us.
		 */
		continuous?: boolean;
		/** Label for the manual-entry field. Defaults to the ticket-code wording. */
		manualLabel?: string;
		manualPlaceholder?: string;
		/**
		 * Submit-button label. Defaults to "Check in" for the event scanner; the org
		 * door page overrides it, because verifying a card checks nobody in and a
		 * button that claims otherwise is a lie about what just happened.
		 */
		manualSubmitLabel?: string;
	}

	const {
		active,
		onScan,
		continuous = false,
		manualLabel = m['qrScannerModal.manualEntryLabel'](),
		manualPlaceholder = m['qrScannerModal.manualEntryPlaceholder'](),
		manualSubmitLabel = m['qrScannerModal.manualEntrySubmit']()
	}: Props = $props();

	// Unique per instance: html5-qrcode addresses its container by DOM id, and the
	// event-admin page can have this mounted twice (scanner modal + a future
	// inline surface). A hard-coded "qr-reader" would make the second instance
	// hijack the first one's <div>.
	// `$props.id()` is only legal as a bare declaration initializer, hence two lines.
	const instanceId = $props.id();
	const readerId = `qr-reader-${instanceId}`;

	let scanner: Html5Qrcode | null = null;
	let isScanning = $state(false);
	let error = $state<string | null>(null);
	let scanSuccess = $state(false);
	let manualCode = $state('');
	let isSubmittingManual = $state(false);

	/** Map a camera failure to a localized, actionable message. */
	function cameraErrorMessage(err: unknown): string {
		switch (classifyCameraError(err)) {
			case 'permission-denied':
				return m['qrScannerModal.error_permissionDenied']();
			case 'not-found':
				return m['qrScannerModal.error_notFound']();
			case 'not-readable':
				return m['qrScannerModal.error_notReadable']();
			default:
				return m['qrScannerModal.error_generic']();
		}
	}

	async function startScanner(facingMode: 'environment' | 'user' = 'environment', isRetry = false) {
		// Camera access requires a secure context (HTTPS or localhost).
		if (typeof window !== 'undefined' && !window.isSecureContext) {
			error = m['qrScannerModal.error_insecureContext']();
			return;
		}

		try {
			error = null;
			if (!scanner) {
				scanner = new Html5Qrcode(readerId);
			}

			await scanner.start(
				{ facingMode }, // Back camera by default, front camera as fallback
				{ fps: 10, qrbox: { width: 250, height: 250 } },
				handleScanSuccess,
				handleScanError
			);

			isScanning = true;
		} catch (err) {
			console.error('Failed to start scanner:', err);

			// The back camera can't satisfy the constraint — try the front camera once.
			if (classifyCameraError(err) === 'overconstrained' && !isRetry) {
				await startScanner('user', true);
				return;
			}

			error = cameraErrorMessage(err);
		}
	}

	async function stopScanner() {
		if (scanner && isScanning) {
			try {
				await scanner.stop();
				isScanning = false;
			} catch (err) {
				console.error('Failed to stop scanner:', err);
			}
		}
	}

	/**
	 * Submit a manually-entered code — the guaranteed fallback when the camera
	 * can't start, and the only keyboard-operable path in. Routes through the same
	 * `onScan` as a camera hit.
	 */
	async function submitManualCode(event?: SubmitEvent) {
		event?.preventDefault();
		const code = manualCode.trim();
		if (!code || isSubmittingManual) return;

		isSubmittingManual = true;
		error = null;
		try {
			await stopScanner();
			await onScan(code);
			manualCode = '';
			if (continuous) await startScanner();
		} catch (err) {
			console.error('Manual scan handling failed:', err);
			error = m['qrScannerModal.error_processFailed']();
			if (continuous) await startScanner();
		} finally {
			isSubmittingManual = false;
		}
	}

	async function handleScanSuccess(decodedText: string) {
		try {
			scanSuccess = true;
			await stopScanner();
			await onScan(decodedText);
			if (continuous) {
				// Brief pause so the success line is readable before the viewfinder
				// comes back and the next person steps up.
				setTimeout(() => {
					if (active) {
						scanSuccess = false;
						startScanner();
					}
				}, 1200);
			}
		} catch (err) {
			console.error('Scan processing error:', err);
			error = m['qrScannerModal.error_processFailed']();
			scanSuccess = false;
			// Restart scanner after error
			setTimeout(() => {
				if (active) {
					startScanner();
				}
			}, 2000);
		}
	}

	/** Most scan errors are just "no QR in frame yet" and are not worth logging. */
	function handleScanError(errorMessage: string) {
		if (!errorMessage.includes('NotFoundException')) {
			console.warn('QR scan error:', errorMessage);
		}
	}

	$effect(() => {
		if (active) {
			startScanner();
		} else {
			stopScanner();
		}
	});

	onDestroy(async () => {
		await stopScanner();
		if (scanner) {
			await scanner.clear();
			scanner = null;
		}
	});
</script>

<div class="relative mb-4">
	<div
		id={readerId}
		class="overflow-hidden rounded-lg border-2 border-primary"
		style="width: 100%; max-width: 500px; margin: 0 auto;"
	></div>

	{#if !isScanning && !error}
		<div class="absolute inset-0 flex items-center justify-center">
			<div class="text-center">
				<Camera class="mx-auto mb-2 h-12 w-12 text-muted-foreground" aria-hidden="true" />
				<p class="text-sm text-muted-foreground">{m['qrScannerModal.initializing']()}</p>
			</div>
		</div>
	{/if}
</div>

{#if error}
	<div
		class="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
		role="alert"
	>
		<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
		<div>
			<p class="font-medium">{m['qrScannerModal.error']()}</p>
			<p>{error}</p>
		</div>
	</div>
{/if}

{#if scanSuccess}
	<!-- Solid fill, not a `/10` tint: this component mounts on a dialog surface in
	     the modal and on a card in the door page, and the registered success tint
	     recipe only clears AA over an opaque card (the same tint over
	     `--background` measures 4.39:1). The solid `--success` /
	     `--success-foreground` pair is surface-independent. -->
	<div
		class="mb-4 rounded-lg bg-success p-3 text-sm font-medium text-success-foreground"
		role="status"
	>
		✓ {m['qrScannerModal.scanSuccess']()}
	</div>
{/if}

<!-- Manual entry: always available, never behind the camera error. It is also the
     only path that works for keyboard and screen-reader users. -->
<form onsubmit={submitManualCode} class="mb-4 rounded-lg border border-border bg-muted/30 p-3">
	<label for="{readerId}-manual" class="mb-2 flex items-center gap-2 text-sm font-medium">
		<KeyRound class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		{manualLabel}
	</label>
	<div class="flex gap-2">
		<input
			id="{readerId}-manual"
			type="text"
			bind:value={manualCode}
			placeholder={manualPlaceholder}
			autocomplete="off"
			autocapitalize="off"
			spellcheck="false"
			class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		/>
		<Button type="submit" disabled={!manualCode.trim() || isSubmittingManual}>
			{manualSubmitLabel}
		</Button>
	</div>
</form>

<style>
	/* Override html5-qrcode default styles */
	:global([id^='qr-reader-']) {
		border: none !important;
	}

	:global([id^='qr-reader-'] video) {
		border-radius: 0.5rem;
		width: 100% !important;
	}

	/* html5-qrcode names its dashboard "<containerId>__dashboard", so the id is
	   per-instance now that the container id is — match on the suffix. */
	:global([id^='qr-reader-'] [id$='__dashboard']) {
		display: none !important;
	}
</style>
