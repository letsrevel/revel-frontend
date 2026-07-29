/*!
 * Revel embed loader — v1
 * https://letsrevel.io
 *
 * Drop this on any page to render Revel content in an iframe:
 *
 *   <script
 *     src="https://letsrevel.io/embed-v1.js"
 *     data-revel-org="my-organization"
 *     data-revel-theme="auto"
 *     data-revel-page-size="6"
 *     async
 *   ></script>
 *
 * Optional: `data-revel-event` or `data-revel-series` to embed a single event
 * or a series; `data-revel-target="#selector"` to render into an existing
 * element instead of replacing this script tag; `data-revel-lang`,
 * `data-revel-tags`, `data-revel-city-id`, `data-revel-event-type`,
 * `data-revel-event-series`, `data-revel-include-past`, `data-revel-order-by`
 * to filter a list; `data-revel-height` for a fixed height (auto-resize is on
 * by default, set `data-revel-resize="false"` to pin it).
 *
 * THE FILENAME IS THE VERSION. `*.js` is served with a one-year immutable
 * cache, so this file's bytes must never change incompatibly — ship breaking
 * changes as `embed-v2.js`.
 */
(function () {
	'use strict';

	var script = document.currentScript;
	if (!script) return;

	var data = script.dataset;
	var org = data.revelOrg;
	if (!org) {
		console.warn('[revel-embed] missing data-revel-org attribute');
		return;
	}

	var base = new URL(script.src, window.location.href);
	var origin = base.origin;

	function path() {
		var prefix = '/embed/' + encodeURIComponent(org);
		if (data.revelEvent) return prefix + '/event/' + encodeURIComponent(data.revelEvent);
		if (data.revelSeries) return prefix + '/series/' + encodeURIComponent(data.revelSeries);
		return prefix;
	}

	var src = new URL(path(), origin);

	// Config attributes → query params, in the order the embed routes read them.
	var params = {
		theme: data.revelTheme,
		lang: data.revelLang,
		tags: data.revelTags,
		city_id: data.revelCityId,
		event_type: data.revelEventType,
		event_series: data.revelEventSeries,
		include_past: data.revelIncludePast,
		order_by: data.revelOrderBy,
		page_size: data.revelPageSize
	};
	Object.keys(params).forEach(function (key) {
		if (params[key]) src.searchParams.set(key, params[key]);
	});

	// Attribution: the embed cannot see the page framing it, so the loader
	// names it. Matches utm_source=embed / utm_medium / utm_campaign, which the
	// embed itself adds to every outbound link.
	src.searchParams.set('utm_content', window.location.hostname);

	var iframe = document.createElement('iframe');
	iframe.src = src.toString();
	iframe.title = data.revelTitle || 'Events on Revel';
	iframe.loading = 'lazy';
	iframe.setAttribute('frameborder', '0');
	iframe.setAttribute('scrolling', 'no');
	iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
	iframe.style.width = '100%';
	iframe.style.maxWidth = '100%';
	iframe.style.border = '0';
	iframe.style.display = 'block';
	iframe.style.height = (parseInt(data.revelHeight, 10) > 0 ? data.revelHeight : '420') + 'px';

	var target = data.revelTarget ? document.querySelector(data.revelTarget) : null;
	if (target) {
		target.appendChild(iframe);
	} else if (script.parentNode) {
		script.parentNode.insertBefore(iframe, script);
	} else {
		return;
	}

	if (data.revelResize === 'false') return;

	// Auto-resize. The embed posts its content height; we only trust messages
	// that come from the embed origin AND from this iframe's own window, so a
	// third script on the host page cannot resize someone else's frame.
	window.addEventListener('message', function (event) {
		if (event.origin !== origin) return;
		if (event.source !== iframe.contentWindow) return;

		var payload = event.data;
		if (!payload || payload.type !== 'revel:embed:height') return;

		var height = Number(payload.height);
		if (!isFinite(height) || height <= 0 || height > 20000) return;

		iframe.style.height = Math.ceil(height) + 'px';
	});
})();
