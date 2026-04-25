import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * `/edit` is deprecated. The canonical admin surface is the dashboard at
 * `../{series_id}/` — series metadata (name, description, logo, cover, tags)
 * is edited from the Series settings dialog there.
 *
 * For one release cycle we 301-redirect with `?settings=open` so the dialog
 * auto-opens on arrival (handled by the dashboard page once Phase 2.7 lands).
 * External links in support docs and backend emails can keep pointing at
 * `/edit` during the transition.
 */
export const load: PageServerLoad = async ({ params }) => {
	// No trailing slash before the query string — SvelteKit's default
	// `trailingSlash: 'never'` would otherwise re-redirect to the no-slash
	// form, costing every old `/edit` link a second 301 hop.
	throw redirect(301, `/org/${params.slug}/admin/event-series/${params.series_id}?settings=open`);
};
