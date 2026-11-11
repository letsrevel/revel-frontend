import * as m from '$lib/paraglide/messages.js';
import type { DemoDescriptionKey, DemoRoleKey } from './demo-accounts';

/** Localized role label for the demo-account picker. Call at render time, never at module load. */
export function demoRoleLabel(key: DemoRoleKey): string {
	switch (key) {
		case 'owner':
			return m['demoAccounts.role.owner']();
		case 'staff':
			return m['demoAccounts.role.staff']();
		case 'member':
			return m['demoAccounts.role.member']();
		case 'attendee':
			return m['demoAccounts.role.attendee']();
		case 'multiOrgMember':
			return m['demoAccounts.role.multiOrgMember']();
		case 'user':
			return m['demoAccounts.role.user']();
	}
}

/** Localized one-line description of a demo account's situation. */
export function demoDescriptionLabel(key: DemoDescriptionKey): string {
	switch (key) {
		case 'fullControl':
			return m['demoAccounts.description.fullControl']();
		case 'canManageEvents':
			return m['demoAccounts.description.canManageEvents']();
		case 'memberPrivileges':
			return m['demoAccounts.description.memberPrivileges']();
		case 'variousTicketsAndRsvps':
			return m['demoAccounts.description.variousTicketsAndRsvps']();
		case 'activeInMultipleEvents':
			return m['demoAccounts.description.activeInMultipleEvents']();
		case 'onWaitlists':
			return m['demoAccounts.description.onWaitlists']();
		case 'pendingPayment':
			return m['demoAccounts.description.pendingPayment']();
		case 'memberOfBothOrgs':
			return m['demoAccounts.description.memberOfBothOrgs']();
		case 'cancelledTicket':
			return m['demoAccounts.description.cancelledTicket']();
		case 'waitlistsAndInvited':
			return m['demoAccounts.description.waitlistsAndInvited']();
	}
}
