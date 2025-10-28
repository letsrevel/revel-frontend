/**
 * Demo test accounts available in demo mode
 * All accounts use password: password123
 *
 * Source: https://github.com/letsrevel/revel-backend/blob/main/src/events/management/commands/README.md#user-accounts
 */
export interface DemoAccount {
	email: string;
	name: string;
	role: string;
	organization?: string;
	description?: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
	// Organization Alpha (Revel Events Collective)
	{
		email: 'alice.owner@example.com',
		name: 'Alice Owner',
		role: 'Owner',
		organization: 'Revel Events Collective',
		description: 'Full control of organization'
	},
	{
		email: 'bob.staff@example.com',
		name: 'Bob Staff',
		role: 'Staff Member',
		organization: 'Revel Events Collective',
		description: 'Can manage events'
	},
	{
		email: 'charlie.member@example.com',
		name: 'Charlie Member',
		role: 'Member',
		organization: 'Revel Events Collective',
		description: 'Member privileges'
	},

	// Organization Beta (Tech Innovators Network)
	{
		email: 'diana.owner@example.com',
		name: 'Diana Owner',
		role: 'Owner',
		organization: 'Tech Innovators Network',
		description: 'Full control of organization'
	},
	{
		email: 'eve.staff@example.com',
		name: 'Eve Staff',
		role: 'Staff Member',
		organization: 'Tech Innovators Network',
		description: 'Can manage events'
	},
	{
		email: 'frank.member@example.com',
		name: 'Frank Member',
		role: 'Member',
		organization: 'Tech Innovators Network',
		description: 'Member privileges'
	},

	// Regular Attendees
	{
		email: 'george.attendee@example.com',
		name: 'George Attendee',
		role: 'Attendee',
		description: 'Has various tickets and RSVPs'
	},
	{
		email: 'hannah.attendee@example.com',
		name: 'Hannah Attendee',
		role: 'Attendee',
		description: 'Active in multiple events'
	},
	{
		email: 'ivan.attendee@example.com',
		name: 'Ivan Attendee',
		role: 'Attendee',
		description: 'On waitlists'
	},
	{
		email: 'julia.attendee@example.com',
		name: 'Julia Attendee',
		role: 'Attendee',
		description: 'Pending payment'
	},

	// Special Users
	{
		email: 'karen.multiorg@example.com',
		name: 'Karen Multi',
		role: 'Multi-org Member',
		description: 'Member of BOTH organizations'
	},
	{
		email: 'leo.pending@example.com',
		name: 'Leo Pending',
		role: 'User',
		description: 'Has cancelled ticket'
	},
	{
		email: 'maria.invited@example.com',
		name: 'Maria Invited',
		role: 'User',
		description: 'On waitlists, invited to events'
	}
];

export const DEMO_PASSWORD = 'password123';

export const DEMO_ACCOUNTS_README_URL =
	'https://github.com/letsrevel/revel-backend/blob/main/src/events/management/commands/README.md#user-accounts';
