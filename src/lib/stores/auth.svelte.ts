import type { RevelUserSchema, OrganizationPermissionsSchema } from '$lib/types/auth';
import {
	authObtainToken,
	authObtainTokenWithOtp,
	accountMe,
	permissionMyPermissions
} from '$lib/api/client';

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
		return this._user !== null && this._accessToken !== null;
	}

	get isLoading() {
		return this._isLoading;
	}

	/**
	 * Initialize auth state (called on app startup)
	 * If access token exists in memory, fetch user data
	 * Otherwise, attempts to refresh token if refresh cookie exists
	 */
	async initialize(): Promise<void> {
		console.log('[AUTH STORE] initialize() called', {
			hasAccessToken: !!this._accessToken
		});
		this._isLoading = true;
		try {
			// If we already have an access token (set from server), fetch user data
			if (this._accessToken) {
				console.log('[AUTH STORE] Has access token, fetching user data');
				await this.fetchUserData();
				console.log('[AUTH STORE] User data fetched successfully');
				await this.fetchPermissions();
				console.log('[AUTH STORE] Permissions fetched successfully');
			} else {
				// Try to refresh the access token
				// If refresh token cookie exists, this will work
				console.log('[AUTH STORE] No access token, attempting refresh');
				await this.refreshAccessToken();
			}
		} catch (error) {
			// No valid refresh token, user needs to login
			// Silent fail - user will be redirected to login by route guard
			console.log('[AUTH STORE] Initialize failed:', error);
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
	 */
	async refreshAccessToken(): Promise<void> {
		try {
			// Call our server-side refresh endpoint
			// The refresh token is in httpOnly cookie, so client can't access it directly
			const response = await fetch('/api/auth/refresh', {
				method: 'POST',
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error('Token refresh failed');
			}

			const data = await response.json();

			if (!data || !data.access) {
				throw new Error('No access token returned');
			}

			// Update the access token (this will also schedule the next refresh)
			this.setAccessToken(data.access);

			// Fetch user data and permissions with the new token
			await this.fetchUserData();
			await this.fetchPermissions();
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
		} catch (err) {
			// Check if this is a network error (likely ad blocker)
			if (err instanceof TypeError && err.message === 'Failed to fetch') {
				console.error('⚠️  API request blocked! Please disable your ad blocker for localhost:8000');
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
	 * Refreshes 3 minutes before the token expires
	 */
	private scheduleTokenRefresh(token: string): void {
		// Clear any existing timer
		if (this._tokenExpiryTimer) {
			clearTimeout(this._tokenExpiryTimer);
			this._tokenExpiryTimer = null;
		}

		// Decode token to get expiration
		const decoded = this.decodeToken(token);
		if (!decoded || !decoded.exp) {
			console.warn('[AUTH STORE] Could not decode token expiration, skipping auto-refresh');
			return;
		}

		// Calculate time until refresh (3 minutes before expiration)
		const expiresAt = decoded.exp * 1000; // Convert to milliseconds
		const now = Date.now();
		const refreshBuffer = 3 * 60 * 1000; // 3 minutes in milliseconds
		const timeUntilRefresh = expiresAt - now - refreshBuffer;

		// If token expires in less than 3 minutes, refresh immediately
		if (timeUntilRefresh <= 0) {
			console.log('[AUTH STORE] Token expires soon, refreshing immediately');
			this.refreshAccessToken().catch((err) => {
				console.error('[AUTH STORE] Auto-refresh failed:', err);
			});
			return;
		}

		console.log(
			`[AUTH STORE] Scheduling token refresh in ${Math.round(timeUntilRefresh / 1000)}s (${Math.round(timeUntilRefresh / 60000)} minutes)`
		);

		// Schedule the refresh
		this._tokenExpiryTimer = setTimeout(() => {
			console.log('[AUTH STORE] Auto-refreshing token');
			this.refreshAccessToken().catch((err) => {
				console.error('[AUTH STORE] Auto-refresh failed:', err);
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
