import { resolve } from '$app/paths';
import { orgHref, rootRelative, type LinkContext, type OrgWithDomain } from '$lib/utils/org-links';

/**
 * Links to an event's public page from the admin editor.
 *
 * `previewHref` stays on the platform: drafts are only visible to staff on the
 * platform origin, so a custom-domain (tenant) link would not show the draft.
 * `shareUrl` is the absolute URL attendees should receive (custom-domain aware).
 */
export function eventPublicLinks(
	org: OrgWithDomain & { slug: string },
	eventSlug: string,
	ctx: LinkContext | null | undefined,
	origin: string
): { previewHref: string; shareUrl: string } {
	const path = resolve('/(public)/events/[org_slug]/[event_slug]', {
		org_slug: org.slug,
		event_slug: eventSlug
	});
	const href = orgHref(org, path, ctx);
	return {
		previewHref: path,
		shareUrl: /^https?:\/\//i.test(href) ? href : `${origin}${rootRelative(href)}`
	};
}
