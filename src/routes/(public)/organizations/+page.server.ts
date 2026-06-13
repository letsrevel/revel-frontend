import type { PageServerLoad } from './$types';
import { organizationListOrganizations } from '$lib/api';
import { error as svelteKitError } from '@sveltejs/kit';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import { getBackendUrl } from '$lib/config/api';
import { log } from '$lib/server/logger';

export const load: PageServerLoad = async ({ request, url, fetch, locals }) => {
	// Parse query parameters
	const search = url.searchParams.get('search') || undefined;
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 20;

	// Parse filter parameters
	const cityId = url.searchParams.get('city_id');
	const tagsParam = url.searchParams.get('tags');
	const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : undefined;
	const orderBy = url.searchParams.get('order_by') || 'distance';

	try {
		// Prepare query parameters
		const queryParams = {
			search,
			city_id: cityId ? parseInt(cityId) : undefined,
			tags,
			page,
			page_size: pageSize,
			order_by: orderBy as 'name' | '-name' | 'distance'
		};

		// Prepare headers with authentication if user is logged in
		const headers: HeadersInit = {};
		if (locals.user?.accessToken) {
			headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
		}

		// Call the API with SSR-compatible fetch and auth headers
		const response = await organizationListOrganizations({
			fetch,
			query: queryParams,
			headers
		});

		// Handle API errors
		if (response.error) {
			log.error('organizations_fetch_failed', { error: response.error });
			throw svelteKitError(500, 'Failed to load organizations. Please try again later.');
		}

		// Type guard: ensure response.data exists
		if (!response.data) {
			log.warning('organizations_response_invalid');
			throw svelteKitError(500, 'Invalid API response');
		}

		const lang = resolveLang(request);
		const organizations = response.data.results;
		const items = organizations.slice(0, 25).map((o) => ({
			name: o.name,
			url: `${url.origin}/org/${o.slug}`,
			image: o.logo ? getBackendUrl(o.logo) : undefined
		}));
		const seo = buildSeo({ kind: 'orgs-listing', url, lang, items });

		// Return paginated data
		return {
			seo,
			organizations,
			totalCount: response.data.count,
			page,
			pageSize,
			nextUrl: response.data.next,
			previousUrl: response.data.previous,
			filters: {
				search,
				cityId: cityId ? parseInt(cityId) : undefined,
				tags,
				orderBy
			}
		};
	} catch (err) {
		log.error('organizations_load_error', { error: err });

		const lang = resolveLang(request);
		const seo = buildSeo({ kind: 'orgs-listing', url, lang });

		// Return empty state rather than throwing to allow graceful degradation
		return {
			seo,
			organizations: [],
			totalCount: 0,
			page: 1,
			pageSize: 20,
			nextUrl: null,
			previousUrl: null,
			filters: {},
			error: 'Failed to load organizations. Please try again later.'
		};
	}
};
