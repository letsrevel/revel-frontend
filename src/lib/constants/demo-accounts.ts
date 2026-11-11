/**
 * Demo test accounts available in demo mode
 * All accounts use password: password123
 *
 * Source: https://github.com/letsrevel/revel-backend/blob/main/src/events/management/commands/README.md#user-accounts
 */
export type DemoRoleKey = 'owner' | 'staff' | 'member' | 'attendee' | 'multiOrgMember' | 'user';
export type DemoDescriptionKey =
	| 'fullControl'
	| 'canManageEvents'
	| 'memberPrivileges'
	| 'variousTicketsAndRsvps'
	| 'activeInMultipleEvents'
	| 'onWaitlists'
	| 'pendingPayment'
	| 'memberOfBothOrgs'
	| 'cancelledTicket'
	| 'waitlistsAndInvited';

export interface DemoAccount {
	email: string;
	name: string;
	/** Stable keys into `demoAccounts.role.*` / `demoAccounts.description.*` (see `demo-accounts-i18n.ts`). */
	roleKey: DemoRoleKey;
	organization?: string;
	descriptionKey?: DemoDescriptionKey;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
	// Organization Alpha (Revel Events Collective)
	{
		email: 'alice.owner@example.com',
		name: 'Alice Owner',
		roleKey: 'owner',
		organization: 'Revel Events Collective',
		descriptionKey: 'fullControl'
	},
	{
		email: 'bob.staff@example.com',
		name: 'Bob Staff',
		roleKey: 'staff',
		organization: 'Revel Events Collective',
		descriptionKey: 'canManageEvents'
	},
	{
		email: 'charlie.member@example.com',
		name: 'Charlie Member',
		roleKey: 'member',
		organization: 'Revel Events Collective',
		descriptionKey: 'memberPrivileges'
	},

	// Organization Beta (Tech Innovators Network)
	{
		email: 'diana.owner@example.com',
		name: 'Diana Owner',
		roleKey: 'owner',
		organization: 'Tech Innovators Network',
		descriptionKey: 'fullControl'
	},
	{
		email: 'eve.staff@example.com',
		name: 'Eve Staff',
		roleKey: 'staff',
		organization: 'Tech Innovators Network',
		descriptionKey: 'canManageEvents'
	},
	{
		email: 'frank.member@example.com',
		name: 'Frank Member',
		roleKey: 'member',
		organization: 'Tech Innovators Network',
		descriptionKey: 'memberPrivileges'
	},

	// Regular Attendees
	{
		email: 'george.attendee@example.com',
		name: 'George Attendee',
		roleKey: 'attendee',
		descriptionKey: 'variousTicketsAndRsvps'
	},
	{
		email: 'hannah.attendee@example.com',
		name: 'Hannah Attendee',
		roleKey: 'attendee',
		descriptionKey: 'activeInMultipleEvents'
	},
	{
		email: 'ivan.attendee@example.com',
		name: 'Ivan Attendee',
		roleKey: 'attendee',
		descriptionKey: 'onWaitlists'
	},
	{
		email: 'julia.attendee@example.com',
		name: 'Julia Attendee',
		roleKey: 'attendee',
		descriptionKey: 'pendingPayment'
	},

	// Special Users
	{
		email: 'karen.multiorg@example.com',
		name: 'Karen Multi',
		roleKey: 'multiOrgMember',
		descriptionKey: 'memberOfBothOrgs'
	},
	{
		email: 'leo.pending@example.com',
		name: 'Leo Pending',
		roleKey: 'user',
		descriptionKey: 'cancelledTicket'
	},
	{
		email: 'maria.invited@example.com',
		name: 'Maria Invited',
		roleKey: 'user',
		descriptionKey: 'waitlistsAndInvited'
	}
];

export const DEMO_PASSWORD = 'password123';

export const DEMO_ACCOUNTS_README_URL =
	'https://github.com/letsrevel/revel-backend/blob/main/src/events/management/commands/README.md#user-accounts';
