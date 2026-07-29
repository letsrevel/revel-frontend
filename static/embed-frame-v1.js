/*!
 * Revel embed frame helper — v1
 * Loaded by /embed/* documents only. https://letsrevel.io
 *
 * Embed pages render with `csr = false`, so this is the ONLY JavaScript they
 * ship. It does two things:
 *
 *   1. Reports the document height to the host page, so `embed-v1.js` can size
 *      the iframe to its content instead of leaving a scrollbar or a gap.
 *   2. Keeps `?theme=auto` honest — with no ModeWatcher in an embed, nothing
 *      else reacts when the host's colour scheme flips at runtime. Explicit
 *      `?theme=light|dark` is applied server-side and locked, so it is left
 *      alone here.
 *
 * THE FILENAME IS THE VERSION: `*.js` is served immutable for a year. Breaking
 * changes ship as `embed-frame-v2.js`.
 */
(function () {
	'use strict';

	if (window.parent === window) return;

	var lastHeight = 0;

	function postHeight() {
		var doc = document.documentElement;
		var height = Math.max(
			doc.scrollHeight,
			doc.offsetHeight,
			document.body ? document.body.scrollHeight : 0
		);
		if (height <= 0 || height === lastHeight) return;
		lastHeight = height;
		// The payload is a single number describing our own layout — nothing
		// private — and the host origin is unknowable from here, so '*' is the
		// only workable target. The LOADER is the side that validates, checking
		// both the message origin and that it came from its own iframe.
		window.parent.postMessage({ type: 'revel:embed:height', height: height }, '*');
	}

	postHeight();
	window.addEventListener('load', postHeight);
	window.addEventListener('resize', postHeight);

	if (typeof ResizeObserver === 'function' && document.documentElement) {
		new ResizeObserver(postHeight).observe(document.documentElement);
	}

	// ?theme=auto only: follow the host's colour scheme as it changes.
	if (!document.documentElement.dataset.themeLocked && window.matchMedia) {
		var query = window.matchMedia('(prefers-color-scheme: dark)');
		var apply = function (event) {
			var root = document.documentElement;
			root.classList.toggle('dark', event.matches);
			root.style.colorScheme = event.matches ? 'dark' : 'light';
			postHeight();
		};
		if (typeof query.addEventListener === 'function') {
			query.addEventListener('change', apply);
		}
	}
})();
