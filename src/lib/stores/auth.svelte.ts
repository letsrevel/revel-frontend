import type { RevelUserSchema, OrganizationPermissionsSchema } from '$lib/types/auth';
import {
	authObtainToken,
	authObtainTokenWithOtp,
	accountMe,
	permissionMyPermissions
} from '$lib/api/client';
import { setLocale } from '$lib/paraglide/runtime.js';

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
	 * Initialize auth state (called on app startup)
	 * If access token exists in memory, fetch user data
	 * Note: This is idempotent - safe to call multiple times
	 */
	async initialize(): Promise<void> {
		console.log('[AUTH STORE] initialize() called', {
			hasAccessToken: !!this._accessToken,
			hasUser: !!this._user,
			isAuthenticated: this.isAuthenticated
		});

		// Only initialize if we have an access token
		if (!this._accessToken) {
			console.log('[AUTH STORE] No access token, skipping initialization');
			return;
		}

		// If we already have user data, skip fetching (idempotent)
		if (this._user && this._permissions) {
			console.log('[AUTH STORE] User data already loaded, skipping fetch');
			return;
		}

		this._isLoading = true;
		try {
			console.log('[AUTH STORE] Fetching user data and permissions');

			// Fetch user data if we don't have it
			if (!this._user) {
				await this.fetchUserData();
				console.log('[AUTH STORE] User data fetched successfully');
			}

			// Fetch permissions if we don't have them
			if (!this._permissions) {
				await this.fetchPermissions();
				console.log('[AUTH STORE] Permissions fetched successfully');
			}
		} catch (error) {
			// If fetching user data fails, the API interceptor will handle token refresh
			// If refresh fails, the user will be logged out automatically
			console.log('[AUTH STORE] Initialize failed:', error);
			// Clear auth state on failure
			this.logout();
		} finally {
			this._isLoading = false;
			console.log('[AUTH STORE] initialize() complete', {
				isAuthenticated: this.isAuthenticated,
				hasUser: !!this._user
			});
		}
	}

	/**
	 * Login with email and password
	 */
	async login(username: string, password: string): Promise<void> {
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
		// Clear the token refresh timer
		this.clearTokenRefreshTimer();

		// Clear in-memory state
		this._user = null;
		this._accessToken = null;
		this._permissions = null;

		// Note: Refresh token cookie will be cleared by server-side hook
		// or by calling a logout endpoint if needed
	}

	/**
	 * Refresh the access token using the refresh token cookie
	 *
	 * IMPORTANT: This calls our server-side endpoint which handles rotating
	 * refresh tokens. Each refresh returns a NEW access and refresh token,
	 * and the old refresh token is blacklisted.
	 */
	async refreshAccessToken(): Promise<void> {
		console.log('[AUTH STORE] Refreshing access token');

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

			console.log('[AUTH STORE] Token refresh successful, received new access token');

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

			console.log('[AUTH STORE] Token refresh complete');
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
			if (data.language && ['en', 'de', 'it'].includes(data.language)) {
				console.log('[AUTH STORE] Setting user preferred language:', data.language);
				setLocale(data.language as 'en' | 'de' | 'it');
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
	 * Update access token (used by interceptor after refresh)
	 */
	setAccessToken(token: string): void {
		this._accessToken = token;
		// Schedule automatic refresh before token expires
		this.scheduleTokenRefresh(token);
	}

	/**
	 * Decode JWT token to get expiration time
	 * Note: This is safe for client-side as JWT is just base64 encoded, not encrypted
	 */
	private decodeToken(token: string): { exp?: number } | null {
		try {
			// JWT format: header.payload.signature
			const parts = token.split('.');
			if (parts.length !== 3) return null;

			// Decode the payload (second part)
			const payload = parts[1];
			const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
			return JSON.parse(decoded);
		} catch (error) {
			console.error('[AUTH STORE] Failed to decode token:', error);
			return null;
		}
	}

	/**
	 * Schedule automatic token refresh before expiration
	 *
	 * Refreshes 5 minutes before the token expires to provide buffer time.
	 * This is a proactive measure to prevent 401 errors.
	 *
	 * IMPORTANT: Always call this after setting/updating the access token
	 * to ensure the refresh chain continues.
	 */
	private scheduleTokenRefresh(token: string): void {
		// Clear any existing timer
		if (this._tokenExpiryTimer) {
			clearTimeout(this._tokenExpiryTimer);
			this._tokenExpiryTimer = null;
			console.log('[AUTH STORE] Cleared existing refresh timer');
		}

		// Decode token to get expiration
		const decoded = this.decodeToken(token);
		if (!decoded || !decoded.exp) {
			console.warn('[AUTH STORE] Could not decode token expiration, skipping auto-refresh');
			return;
		}

		// Calculate time until refresh (5 minutes before expiration for buffer)
		const expiresAt = decoded.exp * 1000; // Convert to milliseconds
		const now = Date.now();
		const refreshBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds (increased from 3)
		const timeUntilRefresh = expiresAt - now - refreshBuffer;

		const expiresInMinutes = Math.round((expiresAt - now) / 60000);
		const refreshInMinutes = Math.round(timeUntilRefresh / 60000);

		console.log(`[AUTH STORE] Token expires in ${expiresInMinutes} minutes`);

		// If token expires in less than 5 minutes, refresh immediately
		if (timeUntilRefresh <= 0) {
			console.log('[AUTH STORE] Token expires very soon, refreshing immediately');
			this.refreshAccessToken().catch((err) => {
				console.error('[AUTH STORE] Immediate auto-refresh failed:', err);
				// Don't try to schedule again on failure
			});
			return;
		}

		console.log(
			`[AUTH STORE] Scheduling token refresh in ${refreshInMinutes} minutes (${Math.round(timeUntilRefresh / 1000)}s)`
		);

		// Schedule the refresh
		this._tokenExpiryTimer = setTimeout(() => {
			console.log('[AUTH STORE] Auto-refresh timer triggered');
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
