import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';

// Billing (and its invoice/credit-note sub-pages) talks exclusively to
// owner-only backend endpoints. The admin nav already hides the item from
// staff, but a direct URL used to render the page shell with every query
// failing — guard the whole subtree like financials does.
export const load: LayoutServerLoad = async ({ parent }) => {
	const { isOwner } = await parent();

	if (!isOwner) {
		throw error(403, 'Only the organization owner can access billing.');
	}

	return {};
};
