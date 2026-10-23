/**
 * Tenant-scoped "my" data (#1056).
 *
 * On an organization's custom domain (tenant mode, #1055) the attendee
 * surfaces (tickets, RSVPs, passes, invitations, calendar, memberships, ...)
 * show only that organization's data. The backend takes an optional
 * `organization` query param on those endpoints (backend #1165); this is the
 * single place that decides when to send it. On the platform host it returns
 * `{}`, so the request is byte-identical to before.
 *
 * Pass `page.data` on the client or `locals` on the server: both carry
 * `tenant` (see `app.d.ts`).
 *
 * Spread the result into the request `query`, and put the same object into the
 * TanStack Query key so tenant and platform caches never mix:
 *
 *   const orgFilter = $derived(tenantOrgFilter(page.data));
 *   createQuery(() => ({
 *     queryKey: ['x', orgFilter],
 *     queryFn: () => sdk({ query: { ...orgFilter } })
 *   }));
 */
export type TenantOrgFilter = { organization?: string };

export function tenantOrgFilter(
	source: { tenant?: { id: string } | null } | null | undefined
): TenantOrgFilter {
	const id = source?.tenant?.id;
	return id ? { organization: id } : {};
}
