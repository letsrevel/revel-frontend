import { apiApiVersion } from '$lib/api/client';
import type { BannerSchema } from '$lib/api/generated/types.gen';

/**
 * App-level store using Svelte 5 Runes
 * Manages application state like backend version and demo mode
 */
class AppStore {
	// Private state
	private _backendVersion = $state<string | null>(null);
	private _isDemoMode = $state<boolean>(false);
	private _isLoadingVersion = $state<boolean>(false);
	private _banner = $state<BannerSchema | null>(null);
	private _bannerExpiryTimer: ReturnType<typeof setTimeout> | null = null;

	// Public computed state
	get backendVersion() {
		return this._backendVersion;
	}

	get isDemoMode() {
		return this._isDemoMode;
	}

	get isLoadingVersion() {
		return this._isLoadingVersion;
	}

	get banner() {
		return this._banner;
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
				this._isDemoMode = false;
				return;
			}

			this._backendVersion = data.version;
			this._isDemoMode = data.demo ?? false;
			this._banner = data.banner ?? null;

			// Client-side expiry: auto-clear banner when ends_at passes
			if (this._banner?.ends_at) {
				const ms = new Date(this._banner.ends_at).getTime() - Date.now();
				if (ms > 0) {
					this._bannerExpiryTimer = setTimeout(() => {
						this._banner = null;
					}, ms);
				} else {
					this._banner = null;
				}
			}
		} catch (error) {
			console.error('Failed to fetch backend version:', error);
			this._backendVersion = 'Unknown';
			this._isDemoMode = false;
		} finally {
			this._isLoadingVersion = false;
		}
	}
}

// Export singleton instance
export const appStore = new AppStore();
