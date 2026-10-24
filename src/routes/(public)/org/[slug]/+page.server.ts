import { loadOrgPage } from '$lib/server/org-page';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => loadOrgPage(event, event.params.slug);
