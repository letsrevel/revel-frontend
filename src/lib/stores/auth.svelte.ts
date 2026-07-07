import type { RevelUserSchema, OrganizationPermissionsSchema } from '$lib/types/auth';
import {
	authObtainToken,
	authObtainTokenWithOtp,
	accountMe,
	permissionMyPermissions
} from '$lib/api/client';
import { setLocale } from '$lib/paraglide/runtime.js';
import { getImpersonationInfo, type ImpersonationInfo } from '$lib/utils/impersonation';
import { decodeToken } from './jwt';

/**
 * Auth store using Svelte 5 Runes
 * Manages authentication state, tokens, and user permissions
 */
class AuthStore {
	// Private state using $state rune
	private _user = $state<RevelUserSchema | null>(null);
	private _accessToken = $state<string | null>(null);
	private _permissions = $state<OrganizationPermissionsSchema | null>(null);
	private _isLoading = $state<boolean>(false);
	private _tokenExpiryTimer: ReturnType<typeof setTimeout> | null = null;
	// Shared promise to prevent concurrent refresh attempts
	private _refreshPromise: Promise<void> | null = null;
	// True only while `logout()` is running. Used by `_performRefresh` to
	// discard an in-flight refresh result if the user explicitly logged out
	// mid-refresh. Previously we used `!_accessToken` for this check, but that
	// gave a false positive during cold-hydration bootstrap (where the store
	// is intentionally empty until the bootstrap refresh completes).
	private _isLoggingOut = false;

	// Public computed state using $derived
	get user() {
		return this._user;
	}

	get accessToken() {
		return this._accessToken;
	}

	get permissions() {
		return this._permissions;
	}

	get isAuthenticated() {
		// Check if we have an access token
		// Don't require user to be fetched - this makes the UI update immediately after login
		// The user will be fetched asynchronously by initialize()
		return this._accessToken !== null;
	}

	get isLoading() {
		return this._isLoading;
	}

	/**
	 * Get impersonation info from the current access token
	 * Returns information about whether this is an impersonated session
	 */
	get impersonationInfo(): ImpersonationInfo {
		return getImpersonationInfo(this._accessToken);
	}

	/**
	 * Check if the current session is impersonated
	 */
	get isImpersonated(): boolean {
		return this.impersonationInfo.isImpersonated;
	}

	/**
	 * Initialize auth state (called on app startup)
	 * If access token exists in memory, fetch user data
	 * Note: This is idempotent - safe to call multiple times
	 */
	async initialize(): Promise<void> {
		// Only initialize if we have an access token
		if (!this._accessToken) {
			return;
		}

		// If we already have user data, skip fetching (idempotent)
		if (this._user && this._permissions) {
			return;
		}

		this._isLoading = true;
		try {
			// Fetch user data if we don't have it
			if (!this._user) {
				await this.fetchUserData();
			}

			// Fetch permissions if we don't have them
			if (!this._permissions) {
				await this.fetchPermissions();
			}
		} catch {
			// If fetching user data fails, the API interceptor will handle token refresh
			// If refresh fails, the user will be logged out automatically
			// Clear auth state on failure
			this.logout();
		} finally {
			this._isLoading = false;
		}
	}

	/**
	 * Login with email and password
	 */
	async login(username: string, password: string): Promise<void> {
		// Intentional new session — clear any lingering logout guard from an
		// earlier logout() in this same SPA session.
		this._isLoggingOut = false;
		this._isLoading = true;
		try {
			const { data, error } = await authObtainToken({
				body: {
					username,
					password
				}
			});

			if (error) {
				throw new Error('Login failed');
			}

			if (!data) {
				throw new Error('No data returned from login');
			}

			// Check if 2FA is required
			if ('type' in data && data.type === 'otp') {
				// Return temp token - caller will handle 2FA flow
				throw new Error('2FA_REQUIRED');
			}

			// Type narrow to TokenObtainPairOutputSchema
			if (!('access' in data)) {
				throw new Error('Invalid response: no access token');
			}

			// Store access token in memory
			this._accessToken = data.access;

			// Fetch user data and permissions
			await this.fetchUserData();
			await this.fetchPermissions();
		} finally {
			this._isLoading = false;
		}
	}

	/**
	 * Complete 2FA login with OTP code
	 */
	async loginWithOTP(tempToken: string, otpCode: string): Promise<void> {
		// Intentional new session — clear any lingering logout guard.
		this._isLoggingOut = false;
		this._isLoading = true;
		try {
			const { data, error } = await authObtainTokenWithOtp({
				body: {
					token: tempToken,
					otp: otpCode
				}
			});

			if (error || !data) {
				throw new Error('OTP verification failed');
			}

			// Store access token in memory
			this._accessToken = data.access;

			// Fetch user data and permissions
			await this.fetchUserData();
			await this.fetchPermissions();
		} finally {
			this._isLoading = false;
		}
	}

	/**
	 * Logout and clear all auth state
	 */
	async logout(): Promise<void> {
		// Mark logout in progress so any concurrent refresh discards its
		// result instead of resurrecting the session.
		this._isLoggingOut = true;

		// Clear the token refresh timer
		this.clearTokenRefreshTimer();

		// Clear any in-progress refresh
		this._refreshPromise = null;

		// Clear in-memory state
		this._user = null;
		this._accessToken = null;
		this._permissions = null;

		// Note: Refresh token cookie will be cleared by server-side hook
		// or by calling a logout endpoint if needed.
		//
		// Intentionally do NOT reset `_isLoggingOut` here. logout() runs
		// synchronously, so a refresh fetch that is already in flight only
		// resolves *after* this method returns; if we cleared the flag now the
		// guard in _performRefresh() would see `false` and resurrect the
		// session. The flag stays set until an intentional new login
		// (login()/loginWithOTP()) clears it.
	}

	/**
	 * Refresh the access token using the refresh token cookie
	 *
	 * IMPORTANT: This calls our server-side endpoint which handles rotating
	 * refresh tokens. Each refresh returns a NEW access and refresh token,
	 * and the old refresh token is blacklisted.
	 *
	 * RACE CONDITION PROTECTION:
	 * This method uses a shared promise to ensure only ONE refresh happens at a time,
	 * even if called from multiple sources (proactive timer + reactive interceptor).
	 * Concurrent calls will wait for the in-flight refresh to complete.
	 *
	 * IMPERSONATION: Refresh is disabled for impersonated sessions.
	 * Impersonation sessions are intentionally limited to 15 minutes
	 * and cannot be extended.
	 */
	async refreshAccessToken(): Promise<void> {
		// IMPORTANT: Do NOT refresh impersonated sessions
		// Impersonation tokens are intentionally short-lived and non-renewable
		if (this.isImpersonated) {
			throw new Error('Impersonation sessions cannot be refreshed');
		}

		// If refresh is already in progress, wait for it to complete
		if (this._refreshPromise) {
			return this._refreshPromise;
		}

		// Create a new refresh promise and store it
		this._refreshPromise = this._performRefresh();

		try {
			// Wait for refresh to complete
			await this._refreshPromise;
		} finally {
			// Clear the promise so next refresh can proceed
			this._refreshPromise = null;
		}
	}

	/**
	 * Internal method that performs the actual refresh
	 * Should only be called by refreshAccessToken()
	 */
	private async _performRefresh(): Promise<void> {
		try {
			// Call our server-side refresh endpoint
			// The refresh token is in httpOnly cookie, so client can't access it directly
			// The server endpoint will read the cookie and call the backend
			const response = await fetch('/api/auth/refresh', {
				method: 'POST',
				credentials: 'include' // Include cookies
			});

			if (!response.ok) {
				console.error('[AUTH STORE] Token refresh failed with status:', response.status);
				throw new Error(`Token refresh failed: ${response.status}`);
			}

			const data = await response.json();

			if (!data || !data.access) {
				console.error('[AUTH STORE] No access token in refresh response');
				throw new Error('No access token returned');
			}

			// Check if user explicitly logged out while refresh was in progress.
			// If so, discard the refresh result so logout wins the race.
			// Note: `!_accessToken` is NOT the right check here — during cold
			// hydration the store is empty by design and refresh is how we
			// learn the token.
			if (this._isLoggingOut) {
				return;
			}

			// Update the access token (this will also schedule the next refresh)
			this.setAccessToken(data.access);

			// Note: We don't need to refetch user data and permissions on every refresh
			// They should still be valid. Only fetch if we don't have them.
			if (!this._user) {
				await this.fetchUserData();
			}
			if (!this._permissions) {
				await this.fetchPermissions();
			}
		} catch (error) {
			console.error('[AUTH STORE] Token refresh failed:', error);
			// Clear auth state on refresh failure
			this.logout();
			throw error;
		}
	}

	/**
	 * Fetch current user data
	 */
	private async fetchUserData(): Promise<void> {
		try {
			const { data, error } = await accountMe({
				headers: this.getAuthHeaders()
			});

			if (error || !data) {
				throw new Error('Failed to fetch user data');
			}

			this._user = data;

			// Set user's preferred language if available
			if (data.language && ['en', 'de', 'it', 'fr'].includes(data.language)) {
				setLocale(data.language as 'en' | 'de' | 'it' | 'fr');
			}
		} catch (err) {
			// Check if this is a network error (likely ad blocker)
			if (err instanceof TypeError && err.message === 'Failed to fetch') {
				const { API_BASE_URL_DISPLAY } = await import('$lib/config/api');
				console.error(
					`⚠️  API request blocked! Please disable your ad blocker for ${API_BASE_URL_DISPLAY}`
				);
				console.error('   Common culprits: uBlock Origin, Privacy Badger, Brave Shields');
			}
			throw err;
		}
	}

	/**
	 * Fetch user permissions
	 */
	private async fetchPermissions(): Promise<void> {
		const { data, error } = await permissionMyPermissions({
			headers: this.getAuthHeaders()
		});

		if (error || !data) {
			console.error('[AUTH STORE] Failed to fetch permissions:', error);
			throw new Error('Failed to fetch permissions');
		}

		this._permissions = data;
	}

	/**
	 * Get authorization headers for API requests
	 */
	getAuthHeaders(): HeadersInit {
		if (!this._accessToken) {
			return {};
		}
		return {
			Authorization: `Bearer ${this._accessToken}`
		};
	}

	/**
	 * Update user data (used after profile edits to keep navbar in sync)
	 */
	setUser(user: RevelUserSchema): void {
		this._user = user;
	}

	/**
	 * Update access token (used by interceptor after refresh)
	 */
	setAccessToken(token: string): void {
		this._accessToken = token;
		// Schedule automatic refresh before token expires
		this.scheduleTokenRefresh(token);
	}

	/**
	 * Bootstrap the in-memory access token from the httpOnly `access_token`
	 * cookie via `/api/auth/session-token`.
	 *
	 * This is the bootstrap path for IMPERSONATION sessions: they carry an
	 * access cookie but NO refresh cookie, so `refreshAccessToken()` 401s for
	 * them. Unlike refresh, this adopts the existing token without minting a
	 * new one. `setAccessToken` handles impersonation-aware scheduling (it
	 * schedules a logout at expiry rather than a refresh).
	 */
	async loadSessionToken(): Promise<void> {
		const response = await fetch('/api/auth/session-token', {
			method: 'GET',
			credentials: 'include'
		});

		if (!response.ok) {
			throw new Error(`Session token bootstrap failed: ${response.status}`);
		}

		const data = await response.json();
		if (!data?.access) {
			throw new Error('No access token returned from session-token endpoint');
		}

		// Respect a logout that happened while this fetch was in flight.
		if (this._isLoggingOut) {
			return;
		}

		this.setAccessToken(data.access);
	}

	/**
	 * Clear the in-memory identity for a server-side session SWAP (impersonation
	 * start/stop, login-as-different-user) so the layout can immediately
	 * re-bootstrap the new identity.
	 *
	 * Unlike `logout()`, this does NOT set `_isLoggingOut` — that flag would
	 * block the very bootstrap (`refreshAccessToken`/`loadSessionToken`) that
	 * runs right after a swap. The server cookies are not touched here; they
	 * already reflect the new identity.
	 */
	resetForSwap(): void {
		this.clearTokenRefreshTimer();
		this._refreshPromise = null;
		this._user = null;
		this._accessToken = null;
		this._permissions = null;
	}

	/**
	 * Schedule automatic token refresh before expiration
	 *
	 * Refreshes 5 minutes before the token expires to provide buffer time.
	 * This is a proactive measure to prevent 401 errors.
	 *
	 * IMPORTANT: Always call this after setting/updating the access token
	 * to ensure the refresh chain continues.
	 *
	 * IMPERSONATION: For impersonated sessions, we schedule a logout
	 * instead of a refresh. Impersonation sessions cannot be extended.
	 */
	private scheduleTokenRefresh(token: string): void {
		// Clear any existing timer
		if (this._tokenExpiryTimer) {
			clearTimeout(this._tokenExpiryTimer);
			this._tokenExpiryTimer = null;
		}

		// Decode token to get expiration
		const decoded = decodeToken(token);
		if (!decoded || !decoded.exp) {
			console.warn('[AUTH STORE] Could not decode token expiration, skipping auto-refresh');
			return;
		}

		// Calculate time until expiration
		const expiresAt = decoded.exp * 1000; // Convert to milliseconds
		const now = Date.now();

		// Check if this is an impersonated session
		const impersonationInfo = getImpersonationInfo(token);
		if (impersonationInfo.isImpersonated) {
			// For impersonation sessions: schedule logout when token expires
			// Do NOT attempt to refresh - impersonation sessions are intentionally limited
			const timeUntilExpiry = expiresAt - now;

			if (timeUntilExpiry <= 0) {
				this.logout();
				return;
			}

			this._tokenExpiryTimer = setTimeout(() => {
				this.logout();
			}, timeUntilExpiry);
			return;
		}

		// Regular session: schedule refresh 5 minutes before expiration
		const refreshBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
		const timeUntilRefresh = expiresAt - now - refreshBuffer;

		// If token expires in less than 5 minutes, refresh immediately
		if (timeUntilRefresh <= 0) {
			this.refreshAccessToken().catch((err) => {
				console.error('[AUTH STORE] Immediate auto-refresh failed:', err);
				// Don't try to schedule again on failure
			});
			return;
		}

		// Schedule the refresh
		this._tokenExpiryTimer = setTimeout(() => {
			this.refreshAccessToken().catch((err) => {
				console.error('[AUTH STORE] Auto-refresh failed:', err);
				// Don't try to schedule again on failure - logout will be called
			});
		}, timeUntilRefresh);
	}

	/**
	 * Clean up timers when logging out
	 */
	private clearTokenRefreshTimer(): void {
		if (this._tokenExpiryTimer) {
			clearTimeout(this._tokenExpiryTimer);
			this._tokenExpiryTimer = null;
		}
	}
}

// Export singleton instance
export const authStore = new AuthStore();
