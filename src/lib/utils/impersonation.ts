/**
 * Impersonation utilities for detecting and handling impersonated sessions
 *
 * When an admin impersonates a user, the JWT access token includes special claims:
 * - is_impersonated: true
 * - impersonated_by_id: UUID of the admin
 * - impersonated_by_email: Email of the admin
 * - impersonated_by_name: Display name of the admin
 * - impersonation_log_id: UUID for audit trail
 */

/**
 * Information about an impersonation session
 */
export interface ImpersonationInfo {
	/** Whether the current session is impersonated */
	isImpersonated: boolean;
	/** UUID of the admin performing impersonation */
	impersonatedById?: string;
	/** Email of the admin performing impersonation */
	impersonatedByEmail?: string;
	/** Display name of the admin performing impersonation */
	impersonatedByName?: string;
	/** UUID for audit trail */
	impersonationLogId?: string;
}

/**
 * Decoded JWT payload with impersonation claims
 */
interface JWTPayload {
	// Standard claims
	user_id?: string;
	sub?: string;
	email?: string;
	exp?: number;

	// Impersonation claims
	is_impersonated?: boolean;
	impersonated_by_id?: string;
	impersonated_by_email?: string;
	impersonated_by_name?: string;
	impersonation_log_id?: string;
}

/**
 * Decode a JWT token to extract its payload
 *
 * Note: This is safe for client-side as JWT is just base64 encoded, not encrypted.
 * We're not verifying the signature here - that's the server's job.
 *
 * @param token - The JWT token to decode
 * @returns The decoded payload or null if decoding fails
 */
export function decodeJWT(token: string): JWTPayload | null {
	try {
		// JWT format: header.payload.signature
		const parts = token.split('.');
		if (parts.length !== 3) return null;

		// Decode the payload (second part)
		const payload = parts[1];
		// Handle URL-safe base64 encoding
		const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
		return JSON.parse(decoded);
	} catch (error) {
		console.error('[IMPERSONATION] Failed to decode JWT:', error);
		return null;
	}
}

/**
 * Extract impersonation information from a JWT token
 *
 * @param token - The JWT access token
 * @returns ImpersonationInfo object with session details
 */
export function getImpersonationInfo(token: string | null): ImpersonationInfo {
	// Default: not impersonated
	if (!token) {
		return { isImpersonated: false };
	}

	const payload = decodeJWT(token);
	if (!payload) {
		return { isImpersonated: false };
	}

	// Check if the token indicates an impersonated session
	if (!payload.is_impersonated) {
		return { isImpersonated: false };
	}

	return {
		isImpersonated: true,
		impersonatedById: payload.impersonated_by_id,
		impersonatedByEmail: payload.impersonated_by_email,
		impersonatedByName: payload.impersonated_by_name,
		impersonationLogId: payload.impersonation_log_id
	};
}

/**
 * Check if a JWT token is for an impersonated session
 *
 * @param token - The JWT access token
 * @returns true if the session is impersonated
 */
export function isImpersonatedSession(token: string | null): boolean {
	return getImpersonationInfo(token).isImpersonated;
}

/**
 * Get the token expiration time in milliseconds since epoch
 *
 * @param token - The JWT access token
 * @returns Expiration time in milliseconds, or null if unable to determine
 */
export function getTokenExpiration(token: string | null): number | null {
	if (!token) return null;

	const payload = decodeJWT(token);
	if (!payload || !payload.exp) return null;

	// JWT exp is in seconds, convert to milliseconds
	return payload.exp * 1000;
}

/**
 * Check if a token is expired or will expire within a given buffer time
 *
 * @param token - The JWT access token
 * @param bufferMs - Buffer time in milliseconds (default: 0)
 * @returns true if the token is expired or will expire within buffer time
 */
export function isTokenExpired(token: string | null, bufferMs: number = 0): boolean {
	const expiration = getTokenExpiration(token);
	if (!expiration) return true; // Treat unknown expiration as expired

	return Date.now() + bufferMs >= expiration;
}
