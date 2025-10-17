import { apiApiVersion } from '$lib/api/client';

/**
 * App-level store using Svelte 5 Runes
 * Manages application state like backend version
 */
class AppStore {
	// Private state
	private _backendVersion = $state<string | null>(null);
	private _isLoadingVersion = $state<boolean>(false);

	// Public computed state
	get backendVersion() {
		return this._backendVersion;
	}

	get isLoadingVersion() {
		return this._isLoadingVersion;
	}

	/**
	 * Fetch backend version from API
	 * Called once at app startup
	 */
	async fetchBackendVersion(): Promise<void> {
		if (this._backendVersion || this._isLoadingVersion) {
			// Already fetched or in progress
			return;
		}

		this._isLoadingVersion = true;
		try {
			const { data, error } = await apiApiVersion();

			if (error || !data) {
				console.error('Failed to fetch backend version:', error);
				this._backendVersion = 'Unknown';
				return;
			}

			this._backendVersion = data.version;
		} catch (error) {
			console.error('Failed to fetch backend version:', error);
			this._backendVersion = 'Unknown';
		} finally {
			this._isLoadingVersion = false;
		}
	}
}

// Export singleton instance
export const appStore = new AppStore();
