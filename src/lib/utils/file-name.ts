/**
 * Extract a display file name from an absolute URL or a relative (possibly
 * signed) path: drops the query string and fragment, then percent-decodes.
 * Returns '' when no name can be found.
 */
export function fileNameFromUrl(fileUrl: string): string {
	let path: string;
	try {
		path = new URL(fileUrl).pathname;
	} catch {
		path = fileUrl;
	}
	const raw = (path.split(/[?#]/)[0] ?? '').split('/').pop() ?? '';
	try {
		return decodeURIComponent(raw);
	} catch {
		// Malformed percent-encoding: show the name as received.
		return raw;
	}
}
