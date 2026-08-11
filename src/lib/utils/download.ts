/**
 * Save an already-fetched blob to the user's disk under a chosen filename.
 *
 * Every generated-document download (ticket PDF, series-pass PDF, membership
 * PDF) grew its own byte-identical copy of this dance. One copy, so a fix to
 * the object-URL lifetime lands everywhere at once.
 */
export function saveBlob(blob: Blob, filename: string): void {
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(url);
}
