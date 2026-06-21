<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onDestroy } from 'svelte';
	import { Html5Qrcode } from 'html5-qrcode';
	import { Button } from '$lib/components/ui/button';
	import { X, Camera, AlertCircle, KeyRound } from 'lucide-svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onScan: (ticketId: string) => Promise<void>;
	}

	const { isOpen, onClose, onScan }: Props = $props();

	let scanner: Html5Qrcode | null = null;
	let isScanning = $state(false);
	let error = $state<string | null>(null);
	let scanSuccess = $state(false);
	let manualCode = $state('');
	let isSubmittingManual = $state(false);

	/**
	 * Returns true if the error matches a given getUserMedia error name, whether it
	 * arrives as a DOMException or as a wrapped string/Error (html5-qrcode does both).
	 */
	function errIncludes(err: unknown, name: string): boolean {
		if (err instanceof DOMException && err.name === name) return true;
		const text = typeof err === 'string' ? err : err instanceof Error ? err.message : '';
		return text.includes(name);
	}

	/**
	 * Map a camera failure to a localized, actionable message. The manual-entry
	 * field below is always available, so every message points the organizer there.
	 */
	function resolveCameraError(err: unknown): string {
		if (errIncludes(err, 'NotAllowedError') || errIncludes(err, 'PermissionDeniedError')) {
			return m['qrScannerModal.error_permissionDenied']();
		}
		if (errIncludes(err, 'NotFoundError') || errIncludes(err, 'DevicesNotFoundError')) {
			return m['qrScannerModal.error_notFound']();
		}
		if (errIncludes(err, 'NotReadableError') || errIncludes(err, 'TrackStartError')) {
			return m['qrScannerModal.error_notReadable']();
		}
		return m['qrScannerModal.error_generic']();
	}

	/**
	 * Start the QR scanner. Falls back to the front camera once if the requested
	 * facing mode can't be satisfied, and surfaces actionable per-error messages.
	 */
	async function startScanner(facingMode: 'environment' | 'user' = 'environment', isRetry = false) {
		// Camera access requires a secure context (HTTPS or localhost).
		if (typeof window !== 'undefined' && !window.isSecureContext) {
			error = m['qrScannerModal.error_insecureContext']();
			return;
		}

		try {
			error = null;
			const scannerId = 'qr-reader';

			// Initialize scanner if not already initialized
			if (!scanner) {
				scanner = new Html5Qrcode(scannerId);
			}

			// Request camera permission and start scanning
			await scanner.start(
				{ facingMode }, // Back camera by default, front camera as fallback
				{
					fps: 10, // Frames per second to scan
					qrbox: { width: 250, height: 250 } // Scanning box size
				},
				handleScanSuccess,
				handleScanError
			);

			isScanning = true;
		} catch (err) {
			console.error('Failed to start scanner:', err);

			// The back camera can't satisfy the constraint — try the front camera once.
			if (errIncludes(err, 'OverconstrainedError') && !isRetry) {
				await startScanner('user', true);
				return;
			}

			error = resolveCameraError(err);
		}
	}

	/**
	 * Submit a manually-entered ticket code — a guaranteed fallback when the camera
	 * can't start. Routes through the same onScan path as a successful scan.
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
		} catch (err) {
			console.error('Manual check-in failed:', err);
			error = m['qrScannerModal.error_processFailed']();
		} finally {
			isSubmittingManual = false;
		}
	}

	/**
	 * Stop the QR scanner
	 */
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
	 * Handle successful QR code scan
	 */
	async function handleScanSuccess(decodedText: string) {
		try {
			scanSuccess = true;
			await stopScanner();

			// The QR code should contain just the ticket ID
			await onScan(decodedText);
		} catch (err) {
			console.error('Scan processing error:', err);
			error = m['qrScannerModal.error_processFailed']();
			scanSuccess = false;
			// Restart scanner after error
			setTimeout(() => {
				if (isOpen) {
					startScanner();
				}
			}, 2000);
		}
	}

	/**
	 * Handle scan errors (most are just "no QR code found" which we can ignore)
	 */
	function handleScanError(errorMessage: string) {
		// We can ignore these errors as they just mean no QR code is visible yet
		// Only log actual errors, not "NotFoundException"
		if (!errorMessage.includes('NotFoundException')) {
			console.warn('QR scan error:', errorMessage);
		}
	}

	/**
	 * Handle modal close
	 */
	async function handleClose() {
		await stopScanner();
		error = null;
		scanSuccess = false;
		manualCode = '';
		onClose();
	}

	/**
	 * Start scanner when modal opens
	 */
	$effect(() => {
		if (isOpen) {
			startScanner();
		} else {
			stopScanner();
		}
	});

	/**
	 * Cleanup on component destroy
	 */
	onDestroy(async () => {
		await stopScanner();
		if (scanner) {
			await scanner.clear();
			scanner = null;
		}
	});
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
			<!-- Header -->
			<div class="mb-4 flex items-center justify-between">
				<h2 id="qr-scanner-title" class="text-xl font-bold">{m['qrScannerModal.scanQr']()}</h2>
				<button
					type="button"
					onclick={handleClose}
					class="rounded-full p-1 hover:bg-accent"
					aria-label={m['qrScannerModal.closeLabel']()}
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Instructions -->
			<p class="mb-4 text-sm text-muted-foreground">
				{m['qrScannerModal.instructions']()}
			</p>

			<!-- Scanner Container -->
			<div class="relative mb-4">
				<div
					id="qr-reader"
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

			<!-- Error Message -->
			{#if error}
				<div
					class="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
					role="alert"
				>
					<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
					<div>
						<p class="font-medium">{m['qrScannerModal.error']()}</p>
						<p>{error}</p>
					</div>
				</div>
			{/if}

			<!-- Success Message -->
			{#if scanSuccess}
				<div
					class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
					role="status"
				>
					✓ {m['qrScannerModal.scanSuccess']()}
				</div>
			{/if}

			<!-- Manual entry fallback (always available when the camera won't start) -->
			<form
				onsubmit={submitManualCode}
				class="mb-4 rounded-lg border border-border bg-muted/30 p-3"
			>
				<label for="manual-ticket-code" class="mb-2 flex items-center gap-2 text-sm font-medium">
					<KeyRound class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
					{m['qrScannerModal.manualEntryLabel']()}
				</label>
				<div class="flex gap-2">
					<input
						id="manual-ticket-code"
						type="text"
						bind:value={manualCode}
						placeholder={m['qrScannerModal.manualEntryPlaceholder']()}
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					/>
					<Button type="submit" disabled={!manualCode.trim() || isSubmittingManual}>
						{m['qrScannerModal.manualEntrySubmit']()}
					</Button>
				</div>
			</form>

			<!-- Actions -->
			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={handleClose}>{m['qrScannerModal.cancel']()}</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Override html5-qrcode default styles */
	:global(#qr-reader) {
		border: none !important;
	}

	:global(#qr-reader video) {
		border-radius: 0.5rem;
		width: 100% !important;
	}

	:global(#qr-reader__dashboard) {
		display: none !important;
	}

	:global(#qr-reader__camera_selection) {
		margin-top: 1rem;
	}
</style>
