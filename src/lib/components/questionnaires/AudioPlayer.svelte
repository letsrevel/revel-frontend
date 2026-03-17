<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { Play, Pause, Download } from 'lucide-svelte';
	import { formatAudioDuration } from '$lib/utils/audio';
	import { audioPreferences } from '$lib/stores/audioPreferences.svelte';
	import { onMount } from 'svelte';

	interface Props {
		/** Audio file URL */
		src: string;
		/** File name for display and download */
		filename: string;
		/** Optional CSS class */
		class?: string;
	}

	const { src, filename, class: className = '' }: Props = $props();

	// Use <video> instead of <audio> because MediaRecorder-produced WebM files
	// have video/webm MIME type, which <audio> elements may reject in some browsers.
	// The <video> element handles both audio/* and video/* content types,
	// and its JavaScript API (play, pause, currentTime, duration) is identical.
	let mediaElement = $state<HTMLVideoElement | null>(null);

	// Playback state
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let isLoaded = $state(false);

	// Derived values
	const formattedCurrentTime = $derived(formatAudioDuration(currentTime));
	const formattedDuration = $derived(formatAudioDuration(duration));
	const progress = $derived(
		duration > 0 && isFinite(duration) ? (currentTime / duration) * 100 : 0
	);
	const speedLabel = $derived(audioPreferences.getSpeedLabel(audioPreferences.playbackSpeed));

	// Initialize preferences on mount
	onMount(() => {
		audioPreferences.initialize();
	});

	// Effect to sync playback rate when it changes
	$effect(() => {
		if (mediaElement) {
			mediaElement.playbackRate = audioPreferences.playbackSpeed;
		}
	});

	// MediaRecorder-produced WebM files often lack duration metadata in the header.
	// The browser reports Infinity until the full file is buffered.
	// This function resolves the real duration by briefly seeking to the end.
	function resolveDuration() {
		if (!mediaElement || !isFinite(mediaElement.duration)) return;
		duration = mediaElement.duration;
	}

	// Audio event handlers
	function handleLoadedMetadata() {
		if (mediaElement) {
			isLoaded = true;
			mediaElement.playbackRate = audioPreferences.playbackSpeed;

			if (isFinite(mediaElement.duration)) {
				duration = mediaElement.duration;
			} else {
				// Duration unknown (common for MediaRecorder WebM files).
				// Seek to a large value to force the browser to determine the real duration.
				mediaElement.currentTime = 1e10;
			}
		}
	}

	function handleTimeUpdate() {
		if (mediaElement) {
			// After the seek-to-end trick, the browser snaps to the real end
			// and the duration becomes finite. Capture it and reset to start.
			if (!isFinite(duration) && isFinite(mediaElement.duration)) {
				duration = mediaElement.duration;
				mediaElement.currentTime = 0;
				return;
			}
			currentTime = mediaElement.currentTime;
		}
	}

	function handleDurationChange() {
		resolveDuration();
	}

	function handleEnded() {
		isPlaying = false;
		if (mediaElement) {
			mediaElement.currentTime = 0;
			currentTime = 0;
		}
	}

	function handlePlay() {
		isPlaying = true;
	}

	function handlePause() {
		isPlaying = false;
	}

	function handleError() {
		if (mediaElement?.error) {
			console.error('Audio playback error:', mediaElement.error.code, mediaElement.error.message);
		}
		isLoaded = false;
		isPlaying = false;
	}

	// Control handlers
	function togglePlayPause() {
		if (!mediaElement) return;

		if (isPlaying) {
			mediaElement.pause();
		} else {
			mediaElement.play().catch((error) => {
				console.error('Failed to play audio:', error);
			});
		}
	}

	function handleSeek(event: Event) {
		if (!mediaElement || !isLoaded) return;

		const target = event.target as HTMLInputElement;
		const seekTime = (parseFloat(target.value) / 100) * duration;
		// Guard against non-finite values (NaN, Infinity)
		if (!isFinite(seekTime)) return;
		mediaElement.currentTime = seekTime;
		currentTime = seekTime;
	}

	function handleSpeedChange(value: string) {
		const speed = parseFloat(value);
		audioPreferences.setPlaybackSpeed(speed);
	}
</script>

<!-- Hidden video element (used instead of <audio> for video/webm MIME type compatibility) -->
<video
	bind:this={mediaElement}
	{src}
	preload="metadata"
	onloadedmetadata={handleLoadedMetadata}
	ontimeupdate={handleTimeUpdate}
	ondurationchange={handleDurationChange}
	onended={handleEnded}
	onplay={handlePlay}
	onpause={handlePause}
	onerror={handleError}
	aria-hidden="true"
	class="hidden"
></video>

<!-- Player UI -->
<div
	class="flex w-full items-center gap-2 rounded-lg border bg-card p-3 {className}"
	role="group"
	aria-label={m['audioPlayer.playerLabel']?.() || 'Audio player'}
>
	<!-- Play/Pause Button -->
	<Button
		variant="ghost"
		size="icon"
		class="h-8 w-8 shrink-0"
		onclick={togglePlayPause}
		disabled={!isLoaded}
		aria-label={isPlaying
			? m['audioPlayer.pause']?.() || 'Pause'
			: m['audioPlayer.play']?.() || 'Play'}
	>
		{#if isPlaying}
			<Pause class="h-4 w-4" />
		{:else}
			<Play class="h-4 w-4" />
		{/if}
	</Button>

	<!-- Progress Bar -->
	<div class="flex min-w-0 flex-1 items-center gap-2">
		<input
			type="range"
			min="0"
			max="100"
			step="0.1"
			value={progress}
			oninput={handleSeek}
			disabled={!isLoaded || !isFinite(duration)}
			class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
			aria-label={m['audioPlayer.seekLabel']?.() || 'Seek'}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(progress)}
		/>
	</div>

	<!-- Time Display -->
	<span class="shrink-0 text-xs tabular-nums text-muted-foreground">
		{formattedCurrentTime}/{formattedDuration}
	</span>

	<!-- Speed Select -->
	<Select
		type="single"
		onValueChange={handleSpeedChange}
		value={String(audioPreferences.playbackSpeed)}
	>
		<SelectTrigger
			class="h-7 w-14 shrink-0 px-2 text-xs"
			aria-label={m['audioPlayer.speed']?.() || 'Playback speed'}
		>
			{speedLabel}
		</SelectTrigger>
		<SelectContent>
			{#each audioPreferences.speedOptions as speed (speed)}
				<SelectItem value={String(speed)}>
					{audioPreferences.getSpeedLabel(speed)}
				</SelectItem>
			{/each}
		</SelectContent>
	</Select>

	<!-- Download Button -->
	<Button
		variant="ghost"
		size="icon"
		class="h-8 w-8 shrink-0"
		href={src}
		target="_blank"
		rel="noopener noreferrer"
		download={filename}
		aria-label={m['audioPlayer.download']?.() || 'Download audio'}
	>
		<Download class="h-4 w-4" />
	</Button>
</div>
