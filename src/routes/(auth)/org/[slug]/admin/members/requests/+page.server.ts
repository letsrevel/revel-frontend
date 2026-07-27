import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The standalone requests page is retired (PR④): the Members-area Requests tab
// absorbed the membership-application model. Permanent redirect keeps old
// bookmarks/notification links working.
export const load: PageServerLoad = async ({ params }) => {
	throw redirect(301, `/org/${params.slug}/admin/members?tab=requests`);
};
