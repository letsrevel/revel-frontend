/**
 * Decode JWT token to get expiration time
 * Note: This is safe for client-side as JWT is just base64 encoded, not encrypted
 */
export function decodeToken(token: string): { exp?: number } | null {
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
