import { API_URL, fetchWithRetry } from './api';

/**
 * Backend availability probe.
 *
 * The whole suite is designed to run against a locally running, freshly
 * bootstrapped backend (see tests/e2e/README.md). When that stack isn't up we
 * skip journey specs politely instead of drowning the report in failures.
 *
 * The probe result is cached for the lifetime of the worker process.
 */
interface VersionInfo {
	demo?: boolean;
	features?: Record<string, boolean>;
	sso_providers?: { key: string; name: string }[];
}

let probe: Promise<VersionInfo | null> | undefined;

function versionInfo(): Promise<VersionInfo | null> {
	probe ??= (async () => {
		try {
			// Generous timeout: the probe races the first burst of parallel-worker
			// backend load; at 3s it intermittently timed out and silently skipped
			// an entire project's tests (cached per worker).
			const response = await fetchWithRetry(`${API_URL}/api/version`, {
				signal: AbortSignal.timeout(10_000)
			});
			if (!response.ok) return null;
			return (await response.json()) as VersionInfo;
		} catch {
			return null;
		}
	})();
	return probe;
}

export async function isBackendUp(): Promise<boolean> {
	return (await versionInfo()) !== null;
}

/**
 * Whether the backend runs in DEMO_MODE. A few UI flows are deliberately
 * disabled on demo instances (e.g. /register redirects to /login) — the
 * affected specs skip themselves with this.
 */
export async function isDemoMode(): Promise<boolean> {
	return (await versionInfo())?.demo === true;
}

/**
 * Whether the backend lists a configured OIDC provider under this key.
 * Reuses the cached /api/version probe. OIDC journeys self-skip when the
 * stack was started without the Keycloak overlay (backend PR #920).
 */
export async function ssoProvider(key: string): Promise<{ key: string; name: string } | null> {
	const info = await versionInfo();
	return info?.sso_providers?.find((provider) => provider.key === key) ?? null;
}

export const BACKEND_DOWN_MESSAGE =
	`No backend at ${API_URL} — start it with \`make run\` (revel-backend) after ` +
	'`make bootstrap`, see tests/e2e/README.md';
