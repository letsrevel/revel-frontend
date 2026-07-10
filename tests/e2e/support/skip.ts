import { API_URL } from './api';

/**
 * Backend availability probe.
 *
 * The whole suite is designed to run against a locally running, freshly
 * bootstrapped backend (see tests/e2e/README.md). When that stack isn't up we
 * skip journey specs politely instead of drowning the report in failures.
 *
 * The probe result is cached for the lifetime of the worker process.
 */
let probe: Promise<boolean> | undefined;

export function isBackendUp(): Promise<boolean> {
	probe ??= (async () => {
		try {
			const response = await fetch(`${API_URL}/api/version`, {
				signal: AbortSignal.timeout(3_000)
			});
			return response.ok;
		} catch {
			return false;
		}
	})();
	return probe;
}

export const BACKEND_DOWN_MESSAGE =
	`No backend at ${API_URL} — start it with \`make run\` (revel-backend) after ` +
	'`make bootstrap`, see tests/e2e/README.md';
