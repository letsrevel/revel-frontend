<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Mic, Square, X, Loader2 } from 'lucide-svelte';
	import {
		isMediaRecorderSupported,
		getSupportedMimeType,
		formatAudioDuration,
		estimateMaxDuration,
		generateRecordingFilename,
		normalizeAudioMimeType
	} from '$lib/utils/audio';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		/** Maximum file size in bytes */
		maxSize: number;
		/** Whether recording is disabled */
		disabled?: boolean;
		/** Callback when recording is complete */
		onRecordingComplete: (file: File) => void;
		/** Callback when recording is cancelled */
		onCancel?: () => void;
	}

	let { maxSize, disabled = false, onRecordingComplete, onCancel }: Props = $props();

	// State machine
	type RecordingState = 'idle' | 'requesting' | 'recording' | 'processing' | 'error';
	let recordingState: RecordingState = $state('idle');
	let errorMessage: string = $state('');

	// Recording state
	let mediaRecorder: MediaRecorder | null = $state(null);
	let mediaStream: MediaStream | null = $state(null);
	let audioChunks: Blob[] = $state([]);
	let recordingStartTime: number = $state(0);
	let elapsedSeconds: number = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = $state(null);

	// Derived values
	let isSupported = $derived(isMediaRecorderSupported());
	let mimeType = $derived(getSupportedMimeType());
	let maxDuration = $derived(estimateMaxDuration(maxSize));
	let remainingSeconds = $derived(Math.max(0, maxDuration - elapsedSeconds));
	let formattedElapsed = $derived(formatAudioDuration(elapsedSeconds));
	let formattedRemaining = $derived(formatAudioDuration(remainingSeconds));
	let isNearLimit = $derived(remainingSeconds < 30 && remainingSeconds > 0);

	// Clean up on unmount
	onDestroy(() => {
		cleanup();
	});

	function cleanup() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		if (mediaStream) {
			mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
			mediaStream = null;
		}
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
		}
		mediaRecorder = null;
		audioChunks = [];
	}

	async function startRecording() {
		if (!isSupported || !mimeType) {
			errorMessage =
				m['audioRecorder.notSupported']?.() || 'Audio recording is not supported in this browser';
			recordingState = 'error';
			return;
		}

		recordingState = 'requesting';
		errorMessage = '';

		try {
			// Request microphone access
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					sampleRate: 44100
				}
			});

			mediaStream = stream;

			// Create MediaRecorder
			const recorder = new MediaRecorder(stream, {
				mimeType
			});

			audioChunks = [];

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					audioChunks = [...audioChunks, event.data];
				}
			};

			recorder.onstop = () => {
				processRecording();
			};

			recorder.onerror = (event) => {
				console.error('MediaRecorder error:', event);
				errorMessage = m['audioRecorder.recordingError']?.() || 'Recording failed';
				recordingState = 'error';
				cleanup();
			};

			mediaRecorder = recorder;
			// Don't use timeslice - collect all data on stop() for a properly formed WebM
			recorder.start();

			// Start timer
			recordingStartTime = Date.now();
			elapsedSeconds = 0;
			timerInterval = setInterval(() => {
				elapsedSeconds = Math.floor((Date.now() - recordingStartTime) / 1000);

				// Auto-stop if we hit the duration limit
				if (elapsedSeconds >= maxDuration) {
					stopRecording();
				}
			}, 100);

			recordingState = 'recording';
		} catch (err) {
			console.error('Failed to start recording:', err);

			if (err instanceof DOMException) {
				if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
					errorMessage =
						m['audioRecorder.permissionDenied']?.() ||
						'Microphone access denied. Please enable it in browser settings.';
				} else if (err.name === 'NotFoundError') {
					errorMessage =
						m['audioRecorder.noMicrophone']?.() ||
						'No microphone found. Please connect a microphone.';
				} else {
					errorMessage = m['audioRecorder.recordingError']?.() || 'Failed to start recording';
				}
			} else {
				errorMessage = m['audioRecorder.recordingError']?.() || 'Failed to start recording';
			}

			recordingState = 'error';
			cleanup();
		}
	}

	function stopRecording() {
		if (mediaRecorder && mediaRecorder.state === 'recording') {
			recordingState = 'processing';
			mediaRecorder.stop();
		}
	}

	function processRecording() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}

		if (audioChunks.length === 0) {
			errorMessage = m['audioRecorder.noAudioRecorded']?.() || 'No audio was recorded';
			recordingState = 'error';
			cleanup();
			return;
		}

		// Get actual MIME type from MediaRecorder (may differ from what we requested)
		// Some browsers (Chrome/Brave) produce video/webm even for audio-only recordings
		const actualMimeType = mediaRecorder?.mimeType || mimeType;
		const normalizedMimeType = normalizeAudioMimeType(actualMimeType);

		// Create blob from chunks with normalized audio MIME type
		const blob = new Blob(audioChunks, { type: normalizedMimeType });

		// Check file size
		if (blob.size > maxSize) {
			errorMessage =
				m['audioRecorder.fileTooLarge']?.() ||
				`Recording is too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`;
			recordingState = 'error';
			cleanup();
			return;
		}

		// Create File object with normalized audio MIME type
		const filename = generateRecordingFilename(normalizedMimeType);
		const file = new File([blob], filename, { type: normalizedMimeType });

		// Clean up media stream
		if (mediaStream) {
			mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
			mediaStream = null;
		}

		// Reset state
		recordingState = 'idle';
		audioChunks = [];
		elapsedSeconds = 0;

		// Notify parent
		onRecordingComplete(file);
	}

	function handleCancel() {
		cleanup();
		recordingState = 'idle';
		elapsedSeconds = 0;
		onCancel?.();
	}

	function handleRetry() {
		errorMessage = '';
		recordingState = 'idle';
	}
</script>

<div class="flex flex-col gap-3">
	{#if recordingState === 'idle'}
		<!-- Idle state: Show record button -->
		<Button
			variant="outline"
			class="gap-2"
			onclick={startRecording}
			disabled={disabled || !isSupported}
		>
			<Mic class="h-4 w-4" />
			{m['audioRecorder.recordAudio']?.() || 'Record Audio'}
		</Button>

		{#if !isSupported}
			<p class="text-xs text-muted-foreground">
				{m['audioRecorder.notSupported']?.() || 'Audio recording is not supported in this browser'}
			</p>
		{:else}
			<p class="text-xs text-muted-foreground">
				{m['audioRecorder.maxDuration']?.({ duration: formattedRemaining }) ||
					`Max duration: ${formattedRemaining}`}
			</p>
		{/if}
	{:else if recordingState === 'requesting'}
		<!-- Requesting permission -->
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<Loader2 class="h-4 w-4 animate-spin" />
			{m['audioRecorder.requestingPermission']?.() || 'Requesting microphone access...'}
		</div>
	{:else if recordingState === 'recording'}
		<!-- Recording state -->
		<div class="flex flex-col gap-2 rounded-lg border bg-card p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<!-- Pulsing recording indicator -->
					<div class="relative flex h-4 w-4 items-center justify-center">
						<div class="absolute h-4 w-4 animate-ping rounded-full bg-red-500 opacity-75"></div>
						<div class="relative h-3 w-3 rounded-full bg-red-500"></div>
					</div>

					<!-- Timer -->
					<span class="font-mono text-lg tabular-nums">{formattedElapsed}</span>
				</div>

				<!-- Remaining time -->
				<span
					class="text-sm tabular-nums {isNearLimit
						? 'font-medium text-destructive'
						: 'text-muted-foreground'}"
				>
					{m['audioRecorder.timeRemaining']?.({ time: formattedRemaining }) ||
						`${formattedRemaining} remaining`}
				</span>
			</div>

			<!-- Controls -->
			<div class="flex items-center gap-2">
				<Button
					variant="default"
					size="sm"
					class="flex-1 gap-2 bg-red-600 hover:bg-red-700"
					onclick={stopRecording}
				>
					<Square class="h-4 w-4" />
					{m['audioRecorder.stop']?.() || 'Stop Recording'}
				</Button>

				<Button variant="ghost" size="sm" onclick={handleCancel} aria-label="Cancel recording">
					<X class="h-4 w-4" />
				</Button>
			</div>
		</div>
	{:else if recordingState === 'processing'}
		<!-- Processing state -->
		<div class="flex items-center gap-2 text-sm text-muted-foreground">
			<Loader2 class="h-4 w-4 animate-spin" />
			{m['audioRecorder.processing']?.() || 'Processing recording...'}
		</div>
	{:else if recordingState === 'error'}
		<!-- Error state -->
		<div class="flex flex-col gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
			<p class="text-sm text-destructive">{errorMessage}</p>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" onclick={handleRetry}>
					{m['audioRecorder.tryAgain']?.() || 'Try Again'}
				</Button>
				<Button variant="ghost" size="sm" onclick={handleCancel}>
					{m['audioRecorder.cancel']?.() || 'Cancel'}
				</Button>
			</div>
		</div>
	{/if}
</div>
