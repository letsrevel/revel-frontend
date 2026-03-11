import { test as authTest, type TestUser, TEST_USERS } from './auth.fixture';

export interface TestEvent {
	id: string;
	orgSlug: string;
	slug: string;
	name: string;
	requiresTicket: boolean;
	potluckOpen: boolean;
}

export interface TestOrganization {
	id: string;
	slug: string;
	name: string;
}

// Known test data from backend seed (`make bootstrap`)
// See: revel-backend/src/events/management/commands/bootstrap_helpers/
export const TEST_DATA = {
	organizations: {
		// Organization Alpha - owned by Alice
		revelEventsCollective: {
			id: 'revel-events-collective-id', // Actual ID assigned at bootstrap
			slug: 'revel-events-collective',
			name: 'Revel Events Collective',
			owner: 'alice.owner@example.com'
		},
		// Organization Beta - owned by Diana
		techInnovatorsNetwork: {
			id: 'tech-innovators-network-id',
			slug: 'tech-innovators-network',
			name: 'Tech Innovators Network',
			owner: 'diana.owner@example.com'
		}
	},
	// Organization slugs for quick access
	orgSlugs: {
		alpha: 'revel-events-collective',
		beta: 'tech-innovators-network'
	},
	events: {
		// Note: Actual event slugs will be created by backend bootstrap
		// These are placeholder structures - tests should discover events dynamically
		publicFreeEvent: {
			id: 'public-free-event-id',
			orgSlug: 'revel-events-collective',
			slug: 'public-free-event',
			name: 'Public Free Event',
			requiresTicket: false,
			potluckOpen: true
		},
		ticketedEvent: {
			id: 'ticketed-event-id',
			orgSlug: 'revel-events-collective',
			slug: 'ticketed-event',
			name: 'Ticketed Event',
			requiresTicket: true,
			potluckOpen: false
		},
		membersOnlyEvent: {
			id: 'members-only-event-id',
			orgSlug: 'tech-innovators-network',
			slug: 'members-only-event',
			name: 'Members Only Event',
			requiresTicket: false,
			potluckOpen: false
		}
	}
};

export type TestDataFixtures = {
	testData: typeof TEST_DATA;
	getEvent: (key: keyof typeof TEST_DATA.events) => TestEvent;
	getOrg: (key: keyof typeof TEST_DATA.organizations) => TestOrganization;
};

export const test = authTest.extend<TestDataFixtures>({
	testData: async (_, use) => {
		await use(TEST_DATA);
	},

	getEvent: async (_, use) => {
		await use((key) => TEST_DATA.events[key]);
	},

	getOrg: async (_, use) => {
		await use((key) => TEST_DATA.organizations[key]);
	}
});

export { expect } from '@playwright/test';
export { TEST_USERS, type TestUser };
