<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onDestroy, untrack } from 'svelte';
	import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
	import { Button } from '$lib/components/ui/button';
	import { classifyCameraError } from '$lib/utils/camera-errors';
	import { CameraController, type CameraPhase } from '$lib/utils/camera-controller';
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
	/** Mirrors the controller's phase; the single source of truth for the camera state. */
	let phase = $state<CameraPhase>('off');
	/** Camera availability / permission problem. A neutral hint when `manualStart`. */
	let error = $state<string | null>(null);
	/** The scan was read but handling it failed. Always the destructive alert. */
	let processError = $state<string | null>(null);
	let scanSuccess = $state(false);
	let manualCode = $state('');
	let isSubmittingManual = $state(false);
	// One scan is handled at a time: overlapping decoder callbacks (and a manual
	// submit during a camera hit) must not call `onScan` twice for one code.
	let handlingScan = $state(false);
	let destroyed = false;
	// Pacing: how long the viewfinder stays off after a handled scan, and how long the
	// same decoded text is ignored afterwards (the card is usually still in frame).
	const RESUME_AFTER_SUCCESS_MS = 1200;
	const RESUME_AFTER_FAILURE_MS = 2000;
	const DEDUPE_WINDOW_MS = 2000;
	let resumeTimer: ReturnType<typeof setTimeout> | null = null;
	let bannerTimer: ReturnType<typeof setTimeout> | null = null;
	let lastHandled: { text: string; at: number } | null = null;
	// With `manualStart` the camera waits for an explicit click. `manualStart` is a
	// mount-time choice, so reading it once here is intended.
	let cameraRequested = $state(untrack(() => !manualStart));
	/** Whether the camera should be running. */
	const wanted = $derived(manualStart ? cameraRequested && active : active);
	const transitioning = $derived(phase === 'starting' || phase === 'stopping');
	const isCard = $derived(codeNoun === 'card');

	/** Camera access requires a secure context (HTTPS or localhost). */
	class InsecureContextError extends Error {}

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

	async function startWith(
		facingMode: 'environment' | 'user' = 'environment',
		isRetry = false
	): Promise<void> {
		scanner ??= new Html5Qrcode(readerId);
		try {
			await scanner.start(
				{ facingMode }, // Back camera by default, front camera as fallback
				{ fps: 10, qrbox: { width: 250, height: 250 } },
				handleScanSuccess,
				handleScanError
			);
		} catch (err) {
			// The back camera can't satisfy the constraint: try the front camera once.
			if (!isRetry && classifyCameraError(err) === 'overconstrained') {
				return startWith('user', true);
			}
			throw err;
		}
	}

	const controller = new CameraController(
		{
			async start() {
				if (typeof window !== 'undefined' && !window.isSecureContext) {
					throw new InsecureContextError();
				}
				error = null;
				await startWith();
			},
			async stop() {
				try {
					await scanner?.stop();
				} catch (err) {
					// html5-qrcode throws when it is not running: that is a stopped camera.
					if (scanner?.getState() === Html5QrcodeScannerState.NOT_STARTED) return;
					throw err;
				}
			}
		},
		{
			onPhase: (p) => (phase = p),
			onStartError(err) {
				if (!(err instanceof InsecureContextError)) console.error('Failed to start scanner:', err);
				// Nobody is waiting for this camera any more, so its failure is not news.
				if (destroyed || !wanted) return;
				error =
					err instanceof InsecureContextError
						? isCard
							? m['qrScannerModal.cardError_insecureContext']()
							: m['qrScannerModal.error_insecureContext']()
						: cameraErrorMessage(err);
				// Hand control back so the button doubles as "try again".
				if (manualStart) cameraRequested = false;
			},
			onStopError: (err) => console.error('Failed to stop scanner:', err)
		}
	);

	function startCamera() {
		error = null;
		processError = null;
		cameraRequested = true;
	}

	function clearResumeTimer() {
		if (resumeTimer) clearTimeout(resumeTimer);
		resumeTimer = null;
	}

	function scheduleResume(delayMs: number) {
		clearResumeTimer();
		resumeTimer = setTimeout(() => {
			resumeTimer = null;
			if (destroyed || !wanted) return;
			controller.setWanted(true);
		}, delayMs);
	}

	function stopCamera() {
		clearResumeTimer();
		error = null;
		processError = null;
		scanSuccess = false;
		cameraRequested = false;
	}

	function processFailedMessage(): string {
		return isCard
			? m['qrScannerModal.cardError_processFailed']()
			: m['qrScannerModal.error_processFailed']();
	}

	/**
	 * Pause the camera, run `onScan`, then schedule the camera to resume (after a
	 * success in continuous mode, after any failure). Returns false when a scan is
	 * already being handled or handling failed. A manual submit does not wait for
	 * the camera to finish stopping: an unanswered permission prompt would hang it.
	 */
	async function processCode(code: string, manual = false): Promise<boolean> {
		if (handlingScan) return false;
		handlingScan = true;
		processError = null;
		clearResumeTimer();
		let ok = false;
		controller.setWanted(false);
		if (!manual) await controller.idle();
		try {
			await onScan(code);
			ok = true;
		} catch (err) {
			console.error('Scan processing error:', err);
			processError = processFailedMessage();
		} finally {
			lastHandled = { text: code, at: Date.now() };
			handlingScan = false;
			if (!destroyed && (ok ? continuous : true)) {
				scheduleResume(ok ? RESUME_AFTER_SUCCESS_MS : RESUME_AFTER_FAILURE_MS);
			}
		}
		return ok;
	}

	/**
	 * Submit a manually-entered code: the guaranteed fallback when the camera
	 * can't start, and the only keyboard-operable path in. Routes through the same
	 * `onScan` as a camera hit.
	 */
	async function submitManualCode(event?: SubmitEvent) {
		event?.preventDefault();
		const code = manualCode.trim();
		if (!code || isSubmittingManual || handlingScan) return;

		isSubmittingManual = true;
		error = null;
		try {
			if (await processCode(code, true)) manualCode = '';
		} finally {
			isSubmittingManual = false;
		}
	}

	async function handleScanSuccess(decodedText: string) {
		if (handlingScan) return;
		if (
			lastHandled &&
			lastHandled.text === decodedText &&
			Date.now() - lastHandled.at < DEDUPE_WINDOW_MS
		) {
			return;
		}
		if (bannerTimer) clearTimeout(bannerTimer);
		bannerTimer = null;
		scanSuccess = true;
		const ok = await processCode(decodedText);
		if (!ok) {
			scanSuccess = false;
		} else if (continuous) {
			// Brief pause so the success line is readable while the viewfinder returns.
			bannerTimer = setTimeout(() => {
				bannerTimer = null;
				scanSuccess = false;
			}, RESUME_AFTER_SUCCESS_MS);
		}
	}

	/** Most scan errors are just "no QR in frame yet" and are not worth logging. */
	function handleScanError(errorMessage: string) {
		if (!errorMessage.includes('NotFoundException')) {
			console.warn('QR scan error:', errorMessage);
		}
	}

	$effect(() => {
		controller.setWanted(wanted);
	});

	onDestroy(() => {
		destroyed = true;
		clearResumeTimer();
		if (bannerTimer) clearTimeout(bannerTimer);
		void controller
			.destroy()
			.then(() => scanner?.clear())
			.catch((err) => console.error('Failed to clear scanner:', err))
			.finally(() => (scanner = null));
	});
</script>

{#if manualStart}
	<div class="mb-4 flex flex-wrap items-center gap-2">
		{#if cameraRequested}
			<Button type="button" variant="outline" onclick={stopCamera}>
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

	{#if phase === 'starting'}
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
		<Button type="submit" disabled={!manualCode.trim() || isSubmittingManual || handlingScan}>
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
