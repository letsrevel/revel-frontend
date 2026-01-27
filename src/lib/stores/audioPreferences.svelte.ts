/**
 * Audio preferences store using Svelte 5 Runes
 * Manages playback speed preference with localStorage persistence
 */
class AudioPreferencesStore {
	// Private state
	private _playbackSpeed = $state<number>(1.0);
	private _initialized = $state<boolean>(false);

	// Valid speed options
	readonly speedOptions = [1.0, 1.5, 2.0] as const;

	// Public computed state
	get playbackSpeed(): number {
		return this._playbackSpeed;
	}

	get initialized(): boolean {
		return this._initialized;
	}

	/**
	 * Set playback speed and persist to localStorage
	 * @param speed Playback speed (1.0, 1.5, or 2.0)
	 */
	setPlaybackSpeed(speed: number): void {
		// Validate speed
		if (!this.speedOptions.includes(speed as (typeof this.speedOptions)[number])) {
			console.warn(`Invalid playback speed: ${speed}. Using 1.0`);
			speed = 1.0;
		}

		this._playbackSpeed = speed;

		// Persist to localStorage
		if (typeof localStorage !== 'undefined') {
			try {
				localStorage.setItem('audioPlaybackSpeed', String(speed));
			} catch {
				// localStorage might be unavailable (e.g., private browsing)
			}
		}
	}

	/**
	 * Initialize from localStorage
	 * Should be called once on app/component mount
	 */
	initialize(): void {
		if (this._initialized) {
			return;
		}

		if (typeof localStorage !== 'undefined') {
			try {
				const saved = localStorage.getItem('audioPlaybackSpeed');
				if (saved) {
					const parsed = parseFloat(saved);
					if (this.speedOptions.includes(parsed as (typeof this.speedOptions)[number])) {
						this._playbackSpeed = parsed;
					}
				}
			} catch {
				// localStorage might be unavailable
			}
		}

		this._initialized = true;
	}

	/**
	 * Get the label for a speed value
	 * @param speed Speed value
	 * @returns Label like "1x", "1.5x", "2x"
	 */
	getSpeedLabel(speed: number): string {
		return `${speed}x`;
	}
}

// Export singleton instance
export const audioPreferences = new AudioPreferencesStore();
