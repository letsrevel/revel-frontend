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

	let { src, filename, class: className = '' }: Props = $props();

	// Audio element reference
	let audioElement = $state<HTMLAudioElement | null>(null);

	// Playback state
	let isPlaying = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	let isLoaded = $state(false);

	// Derived values
	let formattedCurrentTime = $derived(formatAudioDuration(currentTime));
	let formattedDuration = $derived(formatAudioDuration(duration));
	let progress = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
	let speedLabel = $derived(audioPreferences.getSpeedLabel(audioPreferences.playbackSpeed));

	// Initialize preferences on mount
	onMount(() => {
		audioPreferences.initialize();
	});

	// Effect to sync playback rate when it changes
	$effect(() => {
		if (audioElement) {
			audioElement.playbackRate = audioPreferences.playbackSpeed;
		}
	});

	// Audio event handlers
	function handleLoadedMetadata() {
		if (audioElement) {
			duration = audioElement.duration;
			isLoaded = true;
			// Apply current speed preference
			audioElement.playbackRate = audioPreferences.playbackSpeed;
		}
	}

	function handleTimeUpdate() {
		if (audioElement) {
			currentTime = audioElement.currentTime;
		}
	}

	function handleEnded() {
		isPlaying = false;
		if (audioElement) {
			audioElement.currentTime = 0;
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
		// Reset state on error - audio file may be corrupted or unsupported
		isLoaded = false;
		isPlaying = false;
	}

	// Control handlers
	function togglePlayPause() {
		if (!audioElement) return;

		if (isPlaying) {
			audioElement.pause();
		} else {
			audioElement.play().catch((error) => {
				console.error('Failed to play audio:', error);
			});
		}
	}

	function handleSeek(event: Event) {
		if (!audioElement || !isLoaded) return;

		const target = event.target as HTMLInputElement;
		const seekTime = (parseFloat(target.value) / 100) * duration;
		// Guard against non-finite values (NaN, Infinity)
		if (!isFinite(seekTime)) return;
		audioElement.currentTime = seekTime;
		currentTime = seekTime;
	}

	function handleSpeedChange(value: string) {
		const speed = parseFloat(value);
		audioPreferences.setPlaybackSpeed(speed);
	}
</script>

<!-- Hidden audio element -->
<audio
	bind:this={audioElement}
	{src}
	preload="metadata"
	onloadedmetadata={handleLoadedMetadata}
	ontimeupdate={handleTimeUpdate}
	onended={handleEnded}
	onplay={handlePlay}
	onpause={handlePause}
	onerror={handleError}
	aria-hidden="true"
></audio>

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
			disabled={!isLoaded}
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
