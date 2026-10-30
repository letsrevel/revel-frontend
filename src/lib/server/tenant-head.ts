import type { Handle } from '@sveltejs/kit';
import { siteName, tenantIconUrl, themeColor, type SeoTenant } from '$lib/seo/tenant';

/**
 * Tenant document-head rewrite (#1057).
 *
 * `src/app.html` is the single static shell and carries Revel's favicon,
 * theme color, manifest, feed and OpenSearch links. On a tenant host those
 * describe the wrong site, so the first streamed chunk is rewritten with the
 * org's own. The platform path never reaches this code, so its HTML stays
 * byte-identical. A unit test runs {@link rewriteHeadForTenant} against the
 * real `app.html`, so the patterns cannot drift from the shell unnoticed.
 */

/** Path of the tenant web app manifest (the platform keeps the static `/manifest.json`). */
export const TENANT_MANIFEST_PATH = '/manifest.webmanifest';

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

// Line-anchored (`m`): an unanchored leading `[ \t]*` backtracks quadratically on a
// long whitespace run, and the first chunk can carry reflected user input.
const ICON_LINKS_RE = /^[ \t]*<link rel="icon"[^>]*>[ \t]*\r?\n?/gm;
const APPLE_ICON_RE = /<link rel="apple-touch-icon"[^>]*>/;
const THEME_COLOR_RE = /<meta name="theme-color"[^>]*>/;
const MANIFEST_RE = /<link rel="manifest"[^>]*>/;
const FEED_RE = /<link rel="alternate" type="application\/rss\+xml"[^>]*>/;
const OPENSEARCH_RE = /^[ \t]*<link\s+rel="search"[^>]*>\s*/m;

/**
 * Rewrites the Revel-branded head tags of the shell for `tenant`. Only the
 * `<head>…</head>` part is touched; the body (which may reflect user input)
 * is passed through byte-for-byte. Without a `</head>` the html is unchanged.
 */
export function rewriteHeadForTenant(html: string, tenant: SeoTenant): string {
	const headEnd = html.indexOf('</head>');
	if (headEnd === -1) return html;
	const rest = html.slice(headEnd);
	return rewriteHead(html.slice(0, headEnd), tenant) + rest;
}

function rewriteHead(head: string, tenant: SeoTenant): string {
	const icon = tenantIconUrl(tenant);
	let out = head;

	if (icon) {
		const href = escapeAttr(icon);
		let placed = false;
		out = out.replace(ICON_LINKS_RE, () => {
			if (placed) return '';
			placed = true;
			return `\t\t<link rel="icon" href="${href}" />\n`;
		});
		out = out.replace(APPLE_ICON_RE, () => `<link rel="apple-touch-icon" href="${href}" />`);
	}

	// Function replacers throughout: a string replacement would expand `$'`,
	// `$&` and friends inside org-controlled values (e.g. the org name).
	out = out.replace(
		THEME_COLOR_RE,
		() => `<meta name="theme-color" content="${escapeAttr(themeColor(tenant))}" />`
	);
	out = out.replace(MANIFEST_RE, () => `<link rel="manifest" href="${TENANT_MANIFEST_PATH}" />`);
	out = out.replace(
		FEED_RE,
		() =>
			`<link rel="alternate" type="application/rss+xml" title="${escapeAttr(
				`${siteName(tenant)} Events Feed`
			)}" href="/feed.xml" />`
	);
	// /opensearch.xml is a platform-wide search description: 404 on tenant hosts.
	// Its app.html comment stays: SvelteKit counts comments across
	// transformPageChunk and warns ("can break hydration") when one disappears.
	out = out.replace(OPENSEARCH_RE, '');
	return out;
}

/** Applies {@link rewriteHeadForTenant} to the first chunk on tenant hosts only. */
export const handleTenantHead: Handle = async ({ event, resolve }) => {
	const tenant = event.locals.tenant;
	if (!tenant) return resolve(event);

	let done = false;
	return resolve(event, {
		transformPageChunk: ({ html }) => {
			if (done || !html.includes('<head>')) return html;
			done = true;
			return rewriteHeadForTenant(html, tenant);
		}
	});
};
