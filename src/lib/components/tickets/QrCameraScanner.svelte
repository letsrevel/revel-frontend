<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onDestroy, untrack } from 'svelte';
	import { Html5Qrcode } from 'html5-qrcode';
	import { Button } from '$lib/components/ui/button';
	import { classifyCameraError } from '$lib/utils/camera-errors';
	import { Camera, CameraOff, AlertCircle, Info, KeyRound } from '@lucide/svelte';

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
		/**
		 * What is being scanned, for the error copy. `ticket` (default) is the event
		 * check-in wording; `card` is the membership-card wording of the org door page.
		 */
		codeNoun?: 'ticket' | 'card';
		/**
		 * Opt-in: do not ask for the camera on mount. The camera starts only when the
		 * user presses "Scan with camera" (and can be stopped again), manual entry is
		 * shown as an equal option, and a camera failure is a neutral hint rather than
		 * a destructive alert. Off by default, so ticket check-in is unchanged.
		 */
		manualStart?: boolean;
	}

	const {
		active,
		onScan,
		continuous = false,
		manualLabel = m['qrScannerModal.manualEntryLabel'](),
		manualPlaceholder = m['qrScannerModal.manualEntryPlaceholder'](),
		manualSubmitLabel = m['qrScannerModal.manualEntrySubmit'](),
		codeNoun = 'ticket',
		manualStart = false
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
	/** Camera availability / permission problem. A neutral hint when `manualStart`. */
	let error = $state<string | null>(null);
	/** The scan was read but handling it failed. Always the destructive alert. */
	let processError = $state<string | null>(null);
	// A start or a stop is in flight. The buttons wait for it, so a second click
	// cannot start the camera twice or race a stop against a pending start.
	let starting = $state(false);
	let stopping = $state(false);
	const transitioning = $derived(starting || stopping);
	let pendingStart: Promise<void> | null = null;
	// The in-flight `scanner.stop()`. Every later stop caller joins it instead of
	// calling `stop()` again (the second call throws), and a start waits for it.
	let pendingStop: Promise<void> | null = null;
	let scanSuccess = $state(false);
	let manualCode = $state('');
	let isSubmittingManual = $state(false);
	// With `manualStart` the camera waits for an explicit click. `manualStart` is a
	// mount-time choice, so reading it once here is intended.
	let cameraRequested = $state(untrack(() => !manualStart));
	const running = $derived(active && cameraRequested);
	const isCard = $derived(codeNoun === 'card');

	/** Map a camera failure to a localized, actionable message. */
	function cameraErrorMessage(err: unknown): string {
		switch (classifyCameraError(err)) {
			case 'permission-denied':
				return isCard
					? m['qrScannerModal.cardError_permissionDenied']()
					: m['qrScannerModal.error_permissionDenied']();
			case 'not-found':
				return isCard
					? m['qrScannerModal.cardError_notFound']()
					: m['qrScannerModal.error_notFound']();
			case 'not-readable':
				return isCard
					? m['qrScannerModal.cardError_notReadable']()
					: m['qrScannerModal.error_notReadable']();
			default:
				return isCard
					? m['qrScannerModal.cardError_generic']()
					: m['qrScannerModal.error_generic']();
		}
	}

	/**
	 * Start the camera, tracking the in-flight start so a second call joins it
	 * (no double start) and `stopScanner` can wait for it.
	 */
	function startScanner(): Promise<void> {
		if (pendingStart) return pendingStart;
		if (isScanning && !pendingStop) return Promise.resolve();
		starting = true;
		const attempt: Promise<void> = (async () => {
			// A stop is still in flight: let it land, then start only if the camera
			// is still wanted (a stop that finished meanwhile may have been the last word).
			if (pendingStop) {
				await pendingStop;
				if (!running || isScanning) return;
			}
			await doStartScanner();
		})().finally(() => {
			if (pendingStart === attempt) {
				pendingStart = null;
				starting = false;
			}
		});
		pendingStart = attempt;
		return attempt;
	}

	async function doStartScanner(
		facingMode: 'environment' | 'user' = 'environment',
		isRetry = false
	): Promise<void> {
		// Camera access requires a secure context (HTTPS or localhost).
		if (typeof window !== 'undefined' && !window.isSecureContext) {
			error = isCard
				? m['qrScannerModal.cardError_insecureContext']()
				: m['qrScannerModal.error_insecureContext']();
			if (manualStart) cameraRequested = false;
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
			// Stop was asked for (or the component went away) while the camera was
			// still opening: it is on now, so turn it off again.
			if (!running) await stopHardware();
		} catch (err) {
			console.error('Failed to start scanner:', err);
			// Nobody is waiting for this camera any more, so its failure is not news.
			if (!running) return;

			// The back camera can't satisfy the constraint — try the front camera once.
			if (classifyCameraError(err) === 'overconstrained' && !isRetry) {
				await doStartScanner('user', true);
				return;
			}

			error = cameraErrorMessage(err);
			// Hand control back so the button doubles as "try again".
			if (manualStart) cameraRequested = false;
		}
	}

	function startCamera() {
		error = null;
		processError = null;
		cameraRequested = true;
	}

	function stopCamera() {
		error = null;
		processError = null;
		scanSuccess = false;
		cameraRequested = false;
	}

	/**
	 * Stop the camera. A start still in flight is awaited first: it turns the
	 * camera off itself when it lands and nobody wants it, so a Stop pressed
	 * during the permission prompt is not lost. `onlyIfUnwanted` lets the effect
	 * back out when the camera was requested again in the meantime.
	 */
	async function stopScanner(onlyIfUnwanted = false) {
		if (pendingStart) {
			await pendingStart.catch(() => undefined);
			if (onlyIfUnwanted && running) return;
		}
		await stopHardware();
	}

	/** Stop the running camera exactly once; concurrent callers join the same stop. */
	function stopHardware(): Promise<void> {
		if (pendingStop) return pendingStop;
		if (!scanner || !isScanning) return Promise.resolve();
		const active = scanner;
		stopping = true;
		const attempt: Promise<void> = (async () => {
			try {
				await active.stop();
				isScanning = false;
			} catch (err) {
				console.error('Failed to stop scanner:', err);
			}
		})().finally(() => {
			if (pendingStop === attempt) pendingStop = null;
			stopping = false;
		});
		pendingStop = attempt;
		return attempt;
	}

	function processFailedMessage(): string {
		return isCard
			? m['qrScannerModal.cardError_processFailed']()
			: m['qrScannerModal.error_processFailed']();
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
		processError = null;
		try {
			await stopScanner();
			await onScan(code);
			manualCode = '';
			if (continuous && running) await startScanner();
		} catch (err) {
			console.error('Manual scan handling failed:', err);
			processError = processFailedMessage();
			if (continuous && running) await startScanner();
		} finally {
			isSubmittingManual = false;
		}
	}

	async function handleScanSuccess(decodedText: string) {
		try {
			processError = null;
			scanSuccess = true;
			await stopScanner();
			await onScan(decodedText);
			if (continuous) {
				// Brief pause so the success line is readable before the viewfinder
				// comes back and the next person steps up.
				setTimeout(() => {
					if (running) {
						scanSuccess = false;
						startScanner();
					}
				}, 1200);
			}
		} catch (err) {
			console.error('Scan processing error:', err);
			processError = processFailedMessage();
			scanSuccess = false;
			// Restart scanner after error
			setTimeout(() => {
				if (running) {
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
		if (running) {
			startScanner();
		} else {
			stopScanner(true);
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

{#if manualStart}
	<div class="mb-4 flex flex-wrap items-center gap-2">
		{#if cameraRequested}
			<Button type="button" variant="outline" onclick={stopCamera} disabled={stopping}>
				<CameraOff class="mr-2 h-4 w-4" aria-hidden="true" />
				{m['qrScannerModal.stopCamera']()}
			</Button>
		{:else}
			<Button type="button" onclick={startCamera} disabled={transitioning}>
				<Camera class="mr-2 h-4 w-4" aria-hidden="true" />
				{m['qrScannerModal.startCamera']()}
			</Button>
		{/if}
	</div>
{/if}

<div class="relative mb-4" class:hidden={manualStart && !cameraRequested}>
	<div
		id={readerId}
		class="overflow-hidden rounded-lg border-2 border-primary"
		style="width: 100%; max-width: 500px; margin: 0 auto;"
	></div>

	{#if running && !isScanning && !error}
		<div class="absolute inset-0 flex items-center justify-center">
			<div class="text-center">
				<Camera class="mx-auto mb-2 h-12 w-12 text-muted-foreground" aria-hidden="true" />
				<p class="text-sm text-muted-foreground">{m['qrScannerModal.initializing']()}</p>
			</div>
		</div>
	{/if}
</div>

{#if manualStart}
	<!-- Neutral hint: no camera is a normal state on a desktop, not a failure. A
	     polite status, not an alert, and no destructive tone. The region stays
	     mounted and only its content changes, because a live region that appears
	     together with its text is often not announced. -->
	<div
		class={error
			? 'mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted p-3 text-sm text-foreground'
			: undefined}
		role="status"
	>
		{#if error}
			<Info class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
			<p>{error}</p>
		{/if}
	</div>
{/if}

{#if processError || (!manualStart && error)}
	<!-- A scan that was read but could not be handled is a real failure, in every mode. -->
	<div
		class="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
		role="alert"
	>
		<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
		<div>
			<p class="font-medium">{m['qrScannerModal.error']()}</p>
			<p>{processError ?? error}</p>
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
