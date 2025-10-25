<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Html5Qrcode } from 'html5-qrcode';
	import { Button } from '$lib/components/ui/button';
	import { X, Camera, AlertCircle } from 'lucide-svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onScan: (ticketId: string) => Promise<void>;
	}

	let { isOpen, onClose, onScan }: Props = $props();

	let scanner: Html5Qrcode | null = null;
	let isScanning = $state(false);
	let error = $state<string | null>(null);
	let scanSuccess = $state(false);

	/**
	 * Start the QR scanner
	 */
	async function startScanner() {
		try {
			error = null;
			const scannerId = 'qr-reader';

			// Initialize scanner if not already initialized
			if (!scanner) {
				scanner = new Html5Qrcode(scannerId);
			}

			// Request camera permission and start scanning
			await scanner.start(
				{ facingMode: 'environment' }, // Use back camera on mobile
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
			error = 'Failed to access camera. Please ensure camera permissions are granted.';
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
			error = 'Failed to process scanned ticket. Please try again.';
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
				<h2 id="qr-scanner-title" class="text-xl font-bold">Scan QR Code</h2>
				<button
					type="button"
					onclick={handleClose}
					class="rounded-full p-1 hover:bg-accent"
					aria-label="Close scanner"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Instructions -->
			<p class="mb-4 text-sm text-muted-foreground">
				Position the QR code within the frame to check in the attendee.
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
							<p class="text-sm text-muted-foreground">Initializing camera...</p>
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
						<p class="font-medium">Error</p>
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
					✓ QR code scanned successfully! Processing...
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={handleClose}>Cancel</Button>
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
