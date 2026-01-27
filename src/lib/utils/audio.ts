/**
 * Audio utilities for questionnaire recording and playback
 */

/**
 * Check if a MIME type is an audio type
 * @param mimeType MIME type string
 * @returns true if it's an audio type
 */
export function isAudio(mimeType: string): boolean {
	// video/webm is included because browser MediaRecorder produces video/webm container
	// even for audio-only recordings (libmagic detects WebM container as video/webm)
	return mimeType.startsWith('audio/') || mimeType === 'video/webm';
}

/**
 * Check if MediaRecorder API is supported in the current browser
 * @returns true if MediaRecorder is available
 */
export function isMediaRecorderSupported(): boolean {
	return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';
}

/**
 * Get the best supported audio MIME type for recording
 * @returns MIME type string (webm, mp4, or empty if none supported)
 */
export function getSupportedMimeType(): string {
	if (!isMediaRecorderSupported()) {
		return '';
	}

	// Prefer WebM (Chrome/Firefox), fallback to MP4/AAC (Safari)
	const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];

	for (const type of types) {
		if (MediaRecorder.isTypeSupported(type)) {
			return type;
		}
	}

	return '';
}

/**
 * Format duration in seconds to MM:SS string
 * @param seconds Duration in seconds
 * @returns Formatted string like "2:45" or "0:08"
 */
export function formatAudioDuration(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) {
		return '0:00';
	}

	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Estimate maximum recording duration based on file size limit
 * Uses conservative bitrate estimate for WebM/AAC audio
 * @param maxBytes Maximum file size in bytes
 * @returns Estimated max duration in seconds
 */
export function estimateMaxDuration(maxBytes: number): number {
	// Conservative estimate: ~128kbps = 16KB/s
	// Actually WebM with Opus can be lower, but this gives a safe margin
	const bytesPerSecond = 16 * 1024;
	return Math.floor(maxBytes / bytesPerSecond);
}

/**
 * Generate a filename for a recorded audio file
 * @returns Filename like "recording-2024-01-15-143052.webm"
 */
export function generateRecordingFilename(mimeType: string): string {
	const now = new Date();
	const date = now.toISOString().slice(0, 10);
	const time = now.toTimeString().slice(0, 8).replace(/:/g, '');

	// Extract extension from MIME type
	let ext = 'webm';
	if (mimeType.includes('mp4') || mimeType.includes('aac')) {
		ext = 'm4a';
	} else if (mimeType.includes('ogg')) {
		ext = 'ogg';
	}

	return `recording-${date}-${time}.${ext}`;
}

/**
 * Normalize a MIME type to ensure it's an audio type
 * Some browsers (Chrome/Brave) produce video/webm even for audio-only recordings
 * @param mimeType Original MIME type
 * @returns Normalized audio MIME type
 */
export function normalizeAudioMimeType(mimeType: string): string {
	// Replace video/webm with audio/webm (content is identical for audio-only)
	if (mimeType.startsWith('video/webm')) {
		return mimeType.replace('video/webm', 'audio/webm');
	}
	return mimeType;
}

/**
 * Check if accept string includes audio types
 * @param accept File accept string (e.g., "audio/*", "audio/mp3,audio/wav")
 * @returns true if audio is accepted
 */
export function acceptsAudioTypes(accept: string): boolean {
	if (!accept || accept === '*/*') {
		return true;
	}

	const lowerAccept = accept.toLowerCase();
	return lowerAccept.includes('audio/') || lowerAccept.includes('audio/*');
}
