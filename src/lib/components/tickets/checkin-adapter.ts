import type { ComponentProps } from 'svelte';
import type CheckInDialog from './CheckInDialog.svelte';
import type { AdminTicketSchema } from '$lib/api/generated/types.gen';

// CheckInDialog declares a stricter ticket shape than the generated
// AdminTicketSchema (non-nullable id/status, no nulls on user name fields),
// so store the adapted shape for it.
export type CheckInDialogTicket = NonNullable<ComponentProps<typeof CheckInDialog>['ticket']>;

/**
 * Adapt an AdminTicketSchema to CheckInDialog's stricter ticket shape.
 * Only normalizes generator-nullable fields (null -> undefined / ''); the
 * data itself is unchanged.
 */
export function toCheckInTicket(ticket: AdminTicketSchema): CheckInDialogTicket {
	return {
		...ticket,
		id: ticket.id ?? '',
		status: ticket.status ?? '',
		user: {
			...ticket.user,
			email: ticket.user.email ?? undefined,
			preferred_name: ticket.user.preferred_name ?? undefined,
			first_name: ticket.user.first_name ?? undefined,
			last_name: ticket.user.last_name ?? undefined
		},
		seat: ticket.seat ?? undefined,
		// The check-in scan payload (CheckInResponseSchema) carries an explicit
		// sector_name; AdminTicketSchema only nests it under tier.sector, so map
		// that through here so the dialog can show it uniformly.
		sector_name: ticket.tier?.sector?.name ?? undefined
	};
}
